async function testPatchExecutor() {
  // Let's get a real task ID from DB
  const taskId = 'cb1744e5-337e-468f-b3b8-34b4dc7e668d'; 
  const url = `http://localhost:3000/api/tasks/${taskId}`;
  
  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executor: "Kevin Owen" }),
    });
    
    if (!response.ok) {
      console.error("PATCH failed:", await response.text());
    } else {
      const data = await response.json();
      console.log("PATCH success:", data);
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

testPatchExecutor();
