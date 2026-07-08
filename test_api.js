async function testRemindAPI() {
  const taskId = '5ca9a123-4602-4a8c-b01d-e81f6161bec8'; // A task with Kevin Owen, David, Angel
  const url = `http://localhost:3000/api/tasks/${taskId}/remind`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
    });
    
    const data = await response.json();
    console.log("Response:", data);
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

testRemindAPI();
