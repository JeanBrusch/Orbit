import ClientSelectionView from '@/components/client-selection-view'

export const metadata = {
  title: 'Orbit Selection - Portal de Seleção de Imóveis',
  description: 'Portal exclusivo de seleção de imóveis de luxo',
}

const mockData = {
  space: 'luxury-real-estate',
  lead: {
    id: 'lead-123',
    firstName: 'João',
  },
  items: [
    {
      id: 'prop-1',
      title: 'Penthouse no Leblon com Vista para o Mar',
      price: 4200000,
      bedrooms: 4,
      bathrooms: 4,
      area: 380,
      location: 'Leblon, Rio de Janeiro',
      note: 'Penthouse de luxo com acabamento premium, localizado na melhor localização do bairro. Possui terraço panorâmico com vista para a Baía de Guanabara.',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      url: 'https://example.com/property/1',
      coverImage:
        'https://images.unsplash.com/photo-1512917774080-9b274e5be8a0?w=800&q=80',
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1512917774080-9b274e5be8a0?w=800&q=80',
          alt: 'Fachada principal',
        },
        {
          url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
          alt: 'Sala de estar',
        },
        {
          url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
          alt: 'Suíte master',
        },
      ],
      recommendedReason:
        'Imóvel premium com localização estratégica, perfeito para quem busca exclusividade e qualidade de vida.',
    },
    {
      id: 'prop-2',
      title: 'Casa de Praia em Condomínio Fechado',
      price: 3500000,
      bedrooms: 5,
      bathrooms: 5,
      area: 450,
      location: 'Barra da Tijuca, Rio de Janeiro',
      note: 'Casa de praia moderna com piscina aquecida, sala de cinema e adega climatizada. Localizada em condomínio de segurança 24 horas com acesso direto à praia.',
      url: 'https://example.com/property/2',
      coverImage:
        'https://images.unsplash.com/photo-1570129477492-45a003537e1f?w=800&q=80',
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1570129477492-45a003537e1f?w=800&q=80',
          alt: 'Vista da piscina',
        },
        {
          url: 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?w=800&q=80',
          alt: 'Área social',
        },
        {
          url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
          alt: 'Cozinha',
        },
      ],
      recommendedReason:
        'Propriedade com infraestrutura completa, ideal para famílias que buscam conforto e lazer.',
    },
    {
      id: 'prop-3',
      title: 'Apartamento de Luxo Ipanema',
      price: 5800000,
      bedrooms: 3,
      bathrooms: 3,
      area: 250,
      location: 'Ipanema, Rio de Janeiro',
      note: 'Apartamento sofisticado na avenida principal de Ipanema, com vista panorâmica e acabamento de primeira linha. Condomínio com piscina, academia e concierge 24 horas.',
      url: 'https://example.com/property/3',
      coverImage:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
          alt: 'Fachada do prédio',
        },
        {
          url: 'https://images.unsplash.com/photo-1516937941344-00b4b0ba7832?w=800&q=80',
          alt: 'Sala de estar com vista',
        },
        {
          url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
          alt: 'Dormitório suite',
        },
        {
          url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80',
          alt: 'Cozinha equipada',
        },
      ],
      recommendedReason:
        'Localização ímpar em Ipanema, com todas as comodidades e prestígio que o bairro oferece.',
    },
    {
      id: 'prop-4',
      title: 'Mansão com Piscina em Gávea',
      price: 9200000,
      bedrooms: 6,
      bathrooms: 6,
      area: 600,
      location: 'Gávea, Rio de Janeiro',
      note: 'Mansão espetacular com jardim privado, piscina aquecida com hidromassagem e área de lazer completa. Localizada em rua tranquila com segurança privada.',
      videoUrl: 'https://www.youtube.com/embed/ScMzIvxBOZ8',
      url: 'https://example.com/property/4',
      coverImage:
        'https://images.unsplash.com/photo-1577959375944-3fabf2fb4d90?w=800&q=80',
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1577959375944-3fabf2fb4d90?w=800&q=80',
          alt: 'Fachada frontal',
        },
        {
          url: 'https://images.unsplash.com/photo-1571508601766-2dbc4c31486f?w=800&q=80',
          alt: 'Piscina e jardim',
        },
        {
          url: 'https://images.unsplash.com/photo-1586368944529-b34f7c925cda?w=800&q=80',
          alt: 'Sala de jantar',
        },
        {
          url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
          alt: 'Living room',
        },
      ],
      recommendedReason:
        'Imóvel com potencial de investimento, localizado em uma das áreas mais valorizadas da cidade.',
    },
  ],
  initialInteractions: {
    favorited: [],
    discarded: [],
    viewed: [],
  },
}

export default function Page() {
  return <ClientSelectionView data={mockData} slug="luxury-selection" />
}
