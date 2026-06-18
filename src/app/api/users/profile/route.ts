import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { decrypt, encrypt } from '@/lib/auth';

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    const session = await decrypt(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, oldPassword, newPassword, photo } = await request.json();

    const currentUser = await prisma.user.findUnique({
      where: { id: session.userId }
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updates: any = { name, email };
    
    if (photo !== undefined) {
      updates.photo = photo;
    }

    if (oldPassword && newPassword) {
      const isPasswordValid = await bcrypt.compare(oldPassword, currentUser.password);
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Invalid old password' }, { status: 400 });
      }
      updates.password = await bcrypt.hash(newPassword, 10);
    }

    // Check if email is being changed and if it already exists
    if (email !== currentUser.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updates
    });

    // Perbarui session cookie jika nama, email, atau photo berubah
    const newToken = await encrypt({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      photo: updatedUser.photo,
    });

    const response = NextResponse.json({ success: true, user: updatedUser });
    response.cookies.set('session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Server error occurred' }, { status: 500 });
  }
}
