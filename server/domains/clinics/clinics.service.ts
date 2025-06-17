
import { ClinicsRepository } from './clinics.repository';
import type { CreateClinicRequest, UpdateClinicRequest, CreateUserInClinicRequest } from './clinics.types';

export class ClinicsService {
  constructor(private repository: ClinicsRepository) {}

  async getClinicById(clinicId: number) {
    const clinic = await this.repository.getClinicById(clinicId);
    if (!clinic) {
      throw new Error('Clinic not found');
    }
    return clinic;
  }

  async createClinic(data: CreateClinicRequest) {
    return this.repository.createClinic(data);
  }

  async updateClinic(clinicId: number, data: UpdateClinicRequest) {
    const clinic = await this.repository.updateClinic(clinicId, data);
    if (!clinic) {
      throw new Error('Clinic not found');
    }
    return clinic;
  }

  async getClinicUsers(clinicId: number) {
    return this.repository.getClinicUsers(clinicId);
  }

  async createUserInClinic(data: CreateUserInClinicRequest) {
    return this.repository.createUserInClinic(data);
  }

  async removeUserFromClinic(clinicId: number, userId: number) {
    const result = await this.repository.removeUserFromClinic(clinicId, userId);
    if (!result) {
      throw new Error('User not found in clinic');
    }
    return result;
  }
}
