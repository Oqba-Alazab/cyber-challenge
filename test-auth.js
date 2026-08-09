const axios = require('axios');

async function testAuth() {
    const baseUrl = 'http://localhost:3000';
    const credentials = { username: 'admin', password: 'admin123' };
    
    console.log('1. Attempting login...');
    try {
        const loginRes = await axios.post(`${baseUrl}/api/admin/login`, credentials);
        console.log('Login Response:', loginRes.data);
        
        const cookie = loginRes.headers['set-cookie'];
        console.log('Session Cookie received:', cookie ? 'Yes' : 'No');

        console.log('\n2. Checking admin status with cookie...');
        const statusRes = await axios.get(`${baseUrl}/api/admin/status`, {
            headers: { Cookie: cookie[0] }
        });
        console.log('Status Response:', statusRes.data);

        console.log('\n3. Fetching participants with cookie...');
        const participantsRes = await axios.get(`${baseUrl}/api/admin/participants`, {
            headers: { Cookie: cookie[0] }
        });
        console.log('Participants count:', participantsRes.data.participants.length);
        
        if (statusRes.data.authenticated && participantsRes.data.success) {
            console.log('\n✅ Auth system is working perfectly on the server side!');
        } else {
            console.log('\n❌ Auth system has an issue.');
        }
    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) {
            console.error('Error Data:', error.response.data);
        }
    }
}

testAuth();
