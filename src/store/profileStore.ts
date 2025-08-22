import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProfileData {
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  codigoCliente: string;
  codigoCampana: string;
  tipoCliente: string;
  email: string;
  telefono: string;
  genero: string;
  puntos: string;
  idExterno: string;
}

interface ProfileStore {
  profileData: ProfileData;
  setProfileData: (data: Partial<ProfileData>) => void;
  clearProfileData: () => void;
}

const initialProfileData: ProfileData = {
  nombre: "",
  apellido: "",
  fechaNacimiento: "",
  codigoCliente: "",
  codigoCampana: "",
  tipoCliente: "",
  email: "",
  telefono: "",
  genero: "",
  puntos: "",
  idExterno: ""
};

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profileData: initialProfileData,
      
      setProfileData: (data) =>
        set((state) => ({
          profileData: { ...state.profileData, ...data },
        })),

      clearProfileData: () => set({ profileData: initialProfileData }),
    }),
    {
      name: 'profile-storage',
    }
  )
);