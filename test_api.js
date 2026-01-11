fetch('http://localhost:3000/api/analyze-workout-image', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({})
})
    .then(res => res.json())
    .then(data => console.log('Success:', data))
    .catch(error => console.error('Error:', error));
