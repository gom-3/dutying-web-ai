import axios from 'axios';

const llmAxiosInstance = axios.create({
    baseURL: `${import.meta.env.VITE_SERVER_URL}/llm`,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default llmAxiosInstance;
