export type Tutorial = {
  id: string;
  title: string;
  list: string;
};

// Single source of truth for the tutorial videos shown on both the Scenes-page
// sidebar (Tutorials) and the Learn page videos section. Update it here and
// both surfaces update.
export const tutorials: Tutorial[] = [
  {
    id: 'tK5-fyBVnK0',
    title: 'Workshop #1: Creator Hub',
    list: 'PLZnx2g41Pk_s',
  },
  {
    id: 'FBr2gye3qh8',
    title: 'Workshop #2: Building for Mobile',
    list: 'PLZnx2g41Pk_s',
  },
  {
    id: '5OmTTzpPdDc',
    title: 'Workshop #3: Mobile UX & Controls Customization',
    list: 'PLZnx2g41Pk_s',
  },
  {
    id: 'tc1PwYKW1Kc',
    title: 'Workshop #4: Performance, Optimization & VFXs',
    list: 'PLZnx2g41Pk_s',
  },
  {
    id: '52LiG-4VI9c',
    title: 'Making a Scene with the Creator Hub',
    list: 'PLAcRraQmr_GPrMmQekqbMWhyBxo3lXs8p',
  },
  {
    id: 'cNl02PFPdcQ',
    title: 'Item Positioning',
    list: 'PLAcRraQmr_GPrMmQekqbMWhyBxo3lXs8p',
  },
  {
    id: 'UepXpH-k0EI',
    title: 'Using Custom 3D Art',
    list: 'PLAcRraQmr_GPrMmQekqbMWhyBxo3lXs8p',
  },
  {
    id: 'z7HF4GR01hE',
    title: 'Smart Items - Basics',
    list: 'PLAcRraQmr_GPrMmQekqbMWhyBxo3lXs8p',
  },
];
