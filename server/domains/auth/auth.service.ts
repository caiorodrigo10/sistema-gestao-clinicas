
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import type { Storage } from '../../storage';
import type {
  LoginRequest,
  LoginResponse,
  UserProfile,
  PasswordResetRequest,
  PasswordResetResponse,
  ResetPasswordRequest,
  UpdateProfileRequest,
  InvitationRequest,
  AcceptInvitationRequest,
  UserClinicAccess
} from './auth.types';

export class AuthService {
  constructor(private storage: Storage) {}

  async login(data: LoginRequest): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const user = await this.storage.getUserByEmail(data.email);
      if (!user) {
        return { success: false, error: 'Credenciais inválidas' };
      }

      const isValidPassword = await bcrypt.compare(data.password, user.password);
      if (!isValidPassword) {
        return { success: false, error: 'Credenciais inválidas' };
      }

      if (!user.is_active) {
        return { success: false, error: 'Usuário inativo' };
      }

      // Update last login
      await this.storage.updateUser(user.id, {
        last_login: new Date()
      });

      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };

      return { success: true, user: userProfile };
    } catch (error) {
      console.error('Error in login service:', error);
      return { success: false, error: 'Erro interno do servidor' };
    }
  }

  async getUserClinics(userId: string): Promise<UserClinicAccess[]> {
    try {
      return await this.storage.getUserClinics(userId);
    } catch (error) {
      console.error('Error getting user clinics:', error);
      throw new Error('Falha ao buscar clínicas do usuário');
    }
  }

  async createInvitation(clinicId: number, inviterId: string, data: InvitationRequest) {
    try {
      const invitationData = {
        ...data,
        clinic_id: clinicId,
        invited_by: inviterId,
        token: nanoid(32),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      };

      return await this.storage.createClinicInvitation(invitationData);
    } catch (error) {
      console.error('Error creating invitation:', error);
      throw new Error('Falha ao criar convite');
    }
  }

  async acceptInvitation(token: string, userId: string) {
    try {
      const clinicUser = await this.storage.acceptClinicInvitation(token, userId);
      if (!clinicUser) {
        throw new Error('Convite inválido ou expirado');
      }
      return clinicUser;
    } catch (error) {
      console.error('Error accepting invitation:', error);
      throw error;
    }
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<PasswordResetResponse> {
    try {
      const user = await this.storage.getUserByEmail(data.email);
      if (!user) {
        // Don't reveal if email exists for security
        return { message: 'Se o email estiver registrado, você receberá as instruções' };
      }

      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.storage.createPasswordResetToken({
        user_id: user.id,
        token,
        expires_at: expiresAt,
        used: false
      });

      // In development, return token for testing
      const response: PasswordResetResponse = {
        message: 'Se o email estiver registrado, você receberá as instruções'
      };

      if (process.env.NODE_ENV === 'development') {
        response.token = token;
        console.log(`\n🔑 TOKEN DE RECUPERAÇÃO DE SENHA:`);
        console.log(`Email: ${data.email}`);
        console.log(`Token: ${token}`);
        console.log(`Expira em: ${expiresAt.toLocaleString('pt-BR')}\n`);
      }

      return response;
    } catch (error) {
      console.error('Error requesting password reset:', error);
      throw new Error('Erro ao solicitar reset de senha');
    }
  }

  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    try {
      const resetToken = await this.storage.getPasswordResetToken(data.token);
      if (!resetToken) {
        throw new Error('Token inválido ou expirado');
      }

      if (resetToken.used) {
        throw new Error('Token já foi utilizado');
      }

      if (new Date() > new Date(resetToken.expires_at)) {
        throw new Error('Token expirado');
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      await this.storage.updateUser(resetToken.user_id, {
        password: hashedPassword,
        updated_at: new Date()
      });

      await this.storage.markPasswordResetTokenAsUsed(resetToken.id);

      return { message: 'Senha alterada com sucesso' };
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<{ message: string; user: UserProfile }> {
    try {
      const user = await this.storage.getUser(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      let updateData: any = {
        name: data.name,
        email: data.email,
        updated_at: new Date()
      };

      // Handle password change
      if (data.newPassword && data.newPassword.trim()) {
        if (!data.currentPassword || !data.currentPassword.trim()) {
          throw new Error('Senha atual é obrigatória para alterar a senha');
        }

        const isValidPassword = await bcrypt.compare(data.currentPassword, user.password);
        if (!isValidPassword) {
          throw new Error('Senha atual incorreta');
        }

        updateData.password = await bcrypt.hash(data.newPassword, 10);
      }

      await this.storage.updateUser(userId, updateData);

      const updatedUser = await this.storage.getUser(userId);
      const userProfile: UserProfile = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role
      };

      return {
        message: 'Perfil atualizado com sucesso',
        user: userProfile
      };
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }
}
