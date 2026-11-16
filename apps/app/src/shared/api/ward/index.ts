import {createWardApi} from '@dutying/api/ward';
import axiosInstance, {adminAxiosInstance} from '../client';

const WardAPI = createWardApi(axiosInstance, {versionedNames: true});

export const AdminWardAPI = createWardApi(adminAxiosInstance, {basePath: '/admin/wards'});

export default WardAPI;
