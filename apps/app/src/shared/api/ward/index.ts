import {createWardApi} from '@dutying/api/ward';
import axiosInstance, {adminAxiosInstance} from '../client';

const WardAPI = createWardApi(axiosInstance);

export const AdminWardAPI = createWardApi(adminAxiosInstance, {basePath: '/admin/wards'});

export default WardAPI;
