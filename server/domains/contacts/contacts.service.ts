
import { ContactsRepository } from './contacts.repository';
import type { CreateContactRequest, UpdateContactRequest } from './contacts.types';

export class ContactsService {
  constructor(private repository: ContactsRepository) {}

  async getContacts(clinicId: number, filters?: any) {
    return this.repository.getContacts(clinicId, filters);
  }

  async getContactById(contactId: number) {
    const contact = await this.repository.getContactById(contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }
    return contact;
  }

  async createContact(data: CreateContactRequest) {
    return this.repository.createContact(data);
  }

  async updateContact(contactId: number, data: UpdateContactRequest) {
    const contact = await this.repository.updateContact(contactId, data);
    if (!contact) {
      throw new Error('Contact not found');
    }
    return contact;
  }

  async updateContactStatus(contactId: number, status: string) {
    const contact = await this.repository.updateContactStatus(contactId, status);
    if (!contact) {
      throw new Error('Contact not found');
    }
    return contact;
  }
}
