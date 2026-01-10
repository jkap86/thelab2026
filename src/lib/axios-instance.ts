import axios from "axios";
import axiosRetry from "axios-retry";

const axiosInstance = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

axiosRetry(axiosInstance, {
  retries: 3,
  retryDelay: (retryCount) => {
    console.log(`retry attempt: ${retryCount}`);
    return 3000 + retryCount * 2000;
  },
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
});

export default axiosInstance;
