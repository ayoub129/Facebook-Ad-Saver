export interface Collection {
  id: string
  name: string
  subboards?: Subboard[]
}

export interface Subboard {
  id: string
  name: string
}

export interface Ad {
  id: string
  boardId: string
  brand: string
  brandLogo?: string
  title: string
  duration: string
  age: string
  daysActive: number
  videoThumbnail: string
  videoUrl?: string
  adCopy: string
  landingPage: string
  performanceEstimate?: string
  runTime?: string
  launchDate?: string
  aspectRatio?: 'square' | 'portrait' | 'landscape'
  videoHeight?: 'short' | 'medium' | 'tall'
}

export const mockCollections: Collection[] = [
  {
    id: 'george',
    name: 'George',
    subboards: [
      { id: 'george-competitors', name: 'Competitors' },
      { id: 'george-offer', name: 'Offer Ads' },
      { id: 'george-ideas', name: 'Ideas' },
      { id: 'george-ready', name: 'Ready' },
    ]
  },
  {
    id: 'ugc',
    name: 'UGC',
    subboards: [
      { id: 'ugc-dog', name: 'Dog' },
      { id: 'ugc-beauty', name: 'Beauty' },
      { id: 'ugc-home', name: 'Home' },
    ]
  },
  {
    id: 'ecom',
    name: 'Ecom',
    subboards: [
      { id: 'ecom-winning', name: 'Winning Ads' },
      { id: 'ecom-testing', name: 'Testing' },
    ]
  }
]

export const mockAds: Ad[] = [
  {
    id: 'ad-1',
    boardId: 'george-ugc',
    brand: 'Pourri',
    brandLogo: '🧴',
    title: 'Pourri',
    duration: '58d',
    age: '58d',
    daysActive: 58,
    videoThumbnail: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&h=500&fit=crop',
    videoUrl: 'https://videos.pexels.com/video-files/3034335/3034335-sd_small-0.45s_637e7971.mp4',
    adCopy: 'My toddler had 7 accidents in one day—it was exhausting and stressful for both of us...',
    landingPage: 'pourri.com',
    performanceEstimate: '8.2/10',
    runTime: '58 days',
    launchDate: '3 December 2024',
    aspectRatio: 'portrait',
    videoHeight: 'medium'
  },
  {
    id: 'ad-2',
    boardId: 'george-ugc',
    brand: 'Dog Friend',
    brandLogo: '🐕',
    title: 'Dog Friend',
    duration: '345d',
    age: '345d',
    daysActive: 345,
    videoThumbnail: 'https://images.unsplash.com/photo-1560121704-112cd5ff3382?w=400&h=500&fit=crop',
    videoUrl: 'https://videos.pexels.com/video-files/3034335/3034335-sd_small-0.45s_637e7971.mp4',
    adCopy: 'Do you wrestle your dog every day? Revolutionary new pet training method...',
    landingPage: 'dogfriend.com',
    performanceEstimate: '9.1/10',
    runTime: '345 days',
    launchDate: '15 November 2023',
    aspectRatio: 'portrait',
    videoHeight: 'tall'
  },
  {
    id: 'ad-3',
    boardId: 'george-ugc',
    brand: 'Grüns',
    brandLogo: '🌱',
    title: 'Grüns',
    duration: '40d',
    age: '40d',
    daysActive: 40,
    videoThumbnail: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400&h=500&fit=crop',
    videoUrl: 'https://videos.pexels.com/video-files/3034335/3034335-sd_small-0.45s_637e7971.mp4',
    adCopy: 'The most overlooked habit for health is...',
    landingPage: 'gruns.com',
    performanceEstimate: '7.8/10',
    runTime: '40 days',
    launchDate: '25 February 2025',
    aspectRatio: 'portrait',
    videoHeight: 'short'
  },
  {
    id: 'ad-4',
    boardId: 'george-ugc',
    brand: 'Jolie',
    brandLogo: '💄',
    title: 'Jolie',
    duration: '49d',
    age: '49d',
    daysActive: 49,
    videoThumbnail: 'https://images.unsplash.com/photo-1596462502278-bc8d3f7f1d8f?w=400&h=600&fit=crop',
    videoUrl: 'https://videos.pexels.com/video-files/3034335/3034335-sd_small-0.45s_637e7971.mp4',
    adCopy: 'Premium skincare for modern beauty. Experience the difference today...',
    landingPage: 'jolie-beauty.com',
    performanceEstimate: '8.5/10',
    runTime: '49 days',
    launchDate: '17 February 2025',
    aspectRatio: 'portrait',
    videoHeight: 'tall'
  },
  {
    id: 'ad-5',
    boardId: 'ecom-winning',
    brand: 'TrendShop',
    brandLogo: '🛍️',
    title: 'Summer Collection',
    duration: '92d',
    age: '92d',
    daysActive: 92,
    videoThumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=400&fit=crop',
    videoUrl: 'https://videos.pexels.com/video-files/3034335/3034335-sd_small-0.45s_637e7971.mp4',
    adCopy: 'Discover our exclusive summer collection with up to 50% off...',
    landingPage: 'trendshop.com/summer',
    performanceEstimate: '8.9/10',
    runTime: '92 days',
    launchDate: '1 June 2024',
    aspectRatio: 'landscape',
    videoHeight: 'short'
  },
  {
    id: 'ad-6',
    boardId: 'ecom-winning',
    brand: 'TechGear',
    brandLogo: '⚙️',
    title: 'Pro Accessories',
    duration: '125d',
    age: '125d',
    daysActive: 125,
    videoThumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&h=500&fit=crop',
    videoUrl: 'https://videos.pexels.com/video-files/3034335/3034335-sd_small-0.45s_637e7971.mp4',
    adCopy: 'Professional-grade tech accessories for creators and professionals...',
    landingPage: 'techgear-pro.com',
    performanceEstimate: '9.2/10',
    runTime: '125 days',
    launchDate: '15 October 2024',
    aspectRatio: 'square',
    videoHeight: 'medium'
  }
]
