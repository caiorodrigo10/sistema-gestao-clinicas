
import type { IStorage } from '../../storage';
import type { CreateClinicRequest, UpdateClinicRequest, CreateUserInClinicRequest } from './clinics.types';

export class ClinicsRepository {
  constructor(private storage: IStorage) {}

  async getClinicById(clinicId: number) {
    return this.storage.getClinic(clinicId);
  }

  async createClinic(data: CreateClinicRequest) {
    return this.storage.createClinic(data);
  }

  async updateClinic(clinicId: number, data: UpdateClinicRequest) {
    return this.storage.updateClinic(clinicId, data);
  }

  async getClinicUsers(clinicId: number) {
    return this.storage.getClinicUsers(clinicId);
  }

  async createUserInClinic(data: CreateUserInClinicRequest) {
    return this.storage.createUserInClinic(data);
  }

  async removeUserFromClinic(clinicId: number, userId: number) {
    return this.storage.removeUserFromClinic(clinicId, userId);
  }
}
