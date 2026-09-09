import {createHospitalApi} from '@dutying/api/hospital';
import axiosInstance from '../client';

export default createHospitalApi(axiosInstance);
