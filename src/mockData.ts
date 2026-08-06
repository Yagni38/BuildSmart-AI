// Mock Database for BuildSmart AI Platform

export interface Contractor {
  id: string;
  company: string;
  owner: string;
  experience: number; // in years
  projects: number;
  rating: number;
  reviewsCount: number;
  priceEstimate: number; // in lakhs (INR)
  completionTime: number; // in months
  responseTime: string;
  verified: boolean;
  matchScore: number;
  matchReason: string;
  specialty: string;
  location: string;
  warranty: number; // in years
  materialQuality: string; // e.g. "Premium A-Grade", "Standard B-Grade"
}

export interface MaterialItem {
  id: string;
  name: string;
  quantity: string;
  cost: number; // in INR
  supplier: string;
  recommendation: string;
  category: 'structural' | 'finishing' | 'services';
}

export interface BudgetItem {
  name: string;
  estimated: number; // in INR (Lakhs)
  spent: number; // in INR (Lakhs)
  category: string;
}

export interface Milestone {
  id: string;
  name: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  completionPercent: number;
  expenses: number; // in Lakhs
  targetDate: string;
  delayPrediction: string;
  weatherImpact: string;
  comments: string;
  photos: string[];
}

export interface Message {
  id: string;
  sender: 'user' | 'contractor';
  text: string;
  time: string;
  attachment?: {
    type: 'image' | 'video' | 'pdf' | 'quote';
    name: string;
    url?: string;
  };
}

export const INITIAL_CONTRACTORS: Contractor[] = [
  {
    id: 'c1',
    company: 'Apex Builders & Infra',
    owner: 'Rajesh Sharma',
    experience: 15,
    projects: 142,
    rating: 4.9,
    reviewsCount: 86,
    priceEstimate: 42.5, // 42.5 Lakhs
    completionTime: 9,
    responseTime: "within 30 mins",
    verified: true,
    matchScore: 98,
    matchReason: "Fits budget perfectly, near location, highly rated for Modern aesthetics.",
    specialty: "Modern Villas & Minimalism",
    location: "Indiranagar, Bengaluru",
    warranty: 10,
    materialQuality: "Premium A-Grade (Tata Steel, ACC Gold)"
  },
  {
    id: 'c2',
    company: 'Brick & Mortar Co.',
    owner: 'Vikram Reddy',
    experience: 12,
    projects: 98,
    rating: 4.7,
    reviewsCount: 54,
    priceEstimate: 39.0,
    completionTime: 8,
    responseTime: "within 1 hour",
    verified: true,
    matchScore: 95,
    matchReason: "Fastest delivery timeline, robust structural warranty, fits budget.",
    specialty: "Luxury Custom Homes",
    location: "Koramangala, Bengaluru",
    warranty: 12,
    materialQuality: "Premium A-Grade (Jindal Steel, Ultratech)"
  },
  {
    id: 'c3',
    company: 'DecoStruct Developers',
    owner: 'Ananya Rao',
    experience: 8,
    projects: 45,
    rating: 4.6,
    reviewsCount: 32,
    priceEstimate: 46.2,
    completionTime: 11,
    responseTime: "within 2 hours",
    verified: false,
    matchScore: 89,
    matchReason: "Excellent design customization, slightly higher cost and longer timeline.",
    specialty: "Traditional & Sustainable Architecture",
    location: "HSR Layout, Bengaluru",
    warranty: 8,
    materialQuality: "Standard A-Grade (JSW Steel, Ambuja)"
  }
];

export const INITIAL_MATERIALS: MaterialItem[] = [
  {
    id: 'm1',
    name: "OPC 53 Cement",
    quantity: "950 Bags",
    cost: 418000,
    supplier: "UltraTech Depot, Indiranagar",
    recommendation: "Save ₹38,000 by purchasing in bulk through our verified supplier network.",
    category: 'structural'
  },
  {
    id: 'm2',
    name: "TMT Fe 550 Steel",
    quantity: "8.5 Tons",
    cost: 595000,
    supplier: "Tata Tiscon Distributors",
    recommendation: "Steel prices are projected to rise next month. Pre-book now to lock in this price.",
    category: 'structural'
  },
  {
    id: 'm3',
    name: "AAC Blocks (Eco-Bricks)",
    quantity: "4,200 Pcs",
    cost: 210000,
    supplier: "GreenBuild Solutions",
    recommendation: "Replaces traditional red clay bricks. AAC blocks save ₹1.5L in labor and plastering.",
    category: 'structural'
  },
  {
    id: 'm4',
    name: "M-Sand (Plastering)",
    quantity: "42 Brass",
    cost: 168000,
    supplier: "Sands & Aggregates Karnataka",
    recommendation: "Verified triple-washed quality ensures stronger plaster bonding and zero cracks.",
    category: 'structural'
  },
  {
    id: 'm5',
    name: "Vitrifed Tile Flooring",
    quantity: "2,400 Sq.Ft",
    cost: 288000,
    supplier: "Kajaria Galaxy Showroom",
    recommendation: "Choose standard 800x800mm tiles instead of custom sizes to minimize cut wastage by 12%.",
    category: 'finishing'
  },
  {
    id: 'm6',
    name: "Weather Shield Paint",
    quantity: "480 Litres",
    cost: 134000,
    supplier: "Asian Paints Select",
    recommendation: "Includes a 7-year anti-algae guarantee; lowers heat absorption by up to 4°C.",
    category: 'finishing'
  },
  {
    id: 'm7',
    name: "Wiring & Switchgear",
    quantity: "1 Lot",
    cost: 185000,
    supplier: "Havells Premium Store",
    recommendation: "Use FRLS (Flame Retardant Low Smoke) wiring. AI confirmed compatibility check completed.",
    category: 'services'
  },
  {
    id: 'm8',
    name: "CPVC & Drainage Piping",
    quantity: "1 Lot",
    cost: 142000,
    supplier: "Astral Pipes Zone",
    recommendation: "Schedule installation in phase 3 to overlap with labor schedules for plumbing savings.",
    category: 'services'
  }
];

export const INITIAL_BUDGET: BudgetItem[] = [
  { name: 'Material Cost', estimated: 19.4, spent: 14.2, category: 'Materials' },
  { name: 'Labour Wages', estimated: 10.5, spent: 6.8, category: 'Labour' },
  { name: 'Equipment Rental', estimated: 4.8, spent: 3.2, category: 'Equipment' },
  { name: 'Contractor Fee', estimated: 5.5, spent: 2.7, category: 'Fee' },
  { name: 'Govt & Approval Fees', estimated: 2.3, spent: 2.3, category: 'Overhead' }
];

export const INITIAL_MILESTONES: Milestone[] = [
  {
    id: 'ms1',
    name: 'Foundation & Excavation',
    status: 'completed',
    completionPercent: 100,
    expenses: 5.5,
    targetDate: 'May 15, 2026',
    delayPrediction: 'None (Completed)',
    weatherImpact: 'None',
    comments: 'Excavation completed successfully. Column steel reinforcing bars set and concrete poured.',
    photos: [
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=400&q=80'
    ]
  },
  {
    id: 'ms2',
    name: 'Pillar Castings & Walls',
    status: 'completed',
    completionPercent: 100,
    expenses: 8.2,
    targetDate: 'June 30, 2026',
    delayPrediction: 'None (Completed)',
    weatherImpact: 'Slight delay due to summer heat wave, managed via evening curing shifts.',
    comments: 'Lintel levels and wall masonry complete using AAC blocks. Columns fully cured.',
    photos: [
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=400&q=80'
    ]
  },
  {
    id: 'ms3',
    name: 'Roof Slab & Concreting',
    status: 'in-progress',
    completionPercent: 75,
    expenses: 5.8,
    targetDate: 'August 18, 2026',
    delayPrediction: 'High risk of 2-day delay due to heavy rain warnings this weekend.',
    weatherImpact: 'Rain predicted for Aug 9-10. Recommend postponing final slab casting to Aug 11.',
    comments: 'Centering and shuttering finished. Electrical piping lay in progress on reinforcement mesh.',
    photos: [
      'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=400&q=80'
    ]
  },
  {
    id: 'ms4',
    name: 'Electrical Conduit & Plumbing',
    status: 'upcoming',
    completionPercent: 0,
    expenses: 0,
    targetDate: 'September 10, 2026',
    delayPrediction: 'Low risk (dependent on slab completion)',
    weatherImpact: 'Indoor work; unaffected by weather.',
    comments: 'Materials (pipes, electrical wires, switch boxes) pre-booked at locked-in rates.',
    photos: []
  },
  {
    id: 'ms5',
    name: 'Plastering & Painting',
    status: 'upcoming',
    completionPercent: 0,
    expenses: 0,
    targetDate: 'October 15, 2026',
    delayPrediction: 'No delay predicted',
    weatherImpact: 'Moderate risk if dampness persists during early October showers.',
    comments: 'Dual plaster system planned: standard sand-cement base, lime wash primer.',
    photos: []
  },
  {
    id: 'ms6',
    name: 'Interior Fitouts & Woodwork',
    status: 'upcoming',
    completionPercent: 0,
    expenses: 0,
    targetDate: 'November 20, 2026',
    delayPrediction: 'No delay predicted',
    weatherImpact: 'None',
    comments: 'Furniture and wardrobe blueprints ready in the AI Design Studio.',
    photos: []
  }
];

export const INITIAL_CHAT: Message[] = [
  { id: '1', sender: 'contractor', text: "Hello! We have finished setting up the shuttering for the first-floor roof slab. Could you check the layout?", time: "10:15 AM" },
  { id: '2', sender: 'user', text: "Thanks Rajesh. It looks great! Have the electrical conduits been laid out exactly as shown in the AI electrical plan?", time: "10:30 AM" },
  { id: '3', sender: 'contractor', text: "Yes, we followed the CAD layout generated by BuildSmart. We've used Havells conduits as recommended.", time: "10:35 AM" },
  {
    id: '4',
    sender: 'contractor',
    text: "Here is the quotation invoice for the raw plumbing fixtures. Please approve.",
    time: "10:36 AM",
    attachment: {
      type: 'quote',
      name: 'Plumbing_Fixture_Invoice_P3.pdf'
    }
  }
];

export const MOCK_NOTIFICATIONS = [
  { id: 'n1', type: 'milestone', title: 'Milestone 2 Completed', message: 'Pillar Casting & Wall Masonry has been marked complete by Apex Builders.', time: '2 hours ago', read: false },
  { id: 'n2', type: 'price', title: 'Steel Price Warning', message: 'Steel prices are projected to rise by 4.2% in Karnataka next week. Consider locking pre-orders.', time: '5 hours ago', read: false },
  { id: 'n3', type: 'weather', title: 'Heavy Rain Forecast', message: 'Rain expected tomorrow. AI recommends shifting outdoor concreting schedule by 24h.', time: '1 day ago', read: true },
  { id: 'n4', type: 'budget', title: 'AI Saving Suggestion', message: 'Replace clay bricks with AAC Eco-blocks in the guest room partition to save ₹28,000.', time: '2 days ago', read: true }
];

export interface CustomerProject {
  id: string;
  name: string;
  location: string;
  buildingType: string;
  status: string;
  startDate: string;
  totalBudget: number; // in Lakhs
}

export interface SiteUpdate {
  text: string;
  loggedBy: string;
  loggedAt: string;
}

export interface WeatherAlert {
  title: string;
  message: string;
  location: string;
}

export const DEFAULT_CUSTOMER_PROJECT: CustomerProject = {
  id: 'BS-9082',
  name: 'Greenfield Eco-Villa',
  location: 'Indiranagar Plot #48B, Bengaluru',
  buildingType: 'Modern Villa (G+1)',
  status: 'Active Build Phase',
  startDate: 'April 12, 2026',
  totalBudget: 42.5,
};

export const DEFAULT_SITE_UPDATE: SiteUpdate = {
  text: 'Laying electrical conduits on the shuttering steel mesh for first-floor roof slab. Slab casting postponed to next Tuesday due to rain prediction.',
  loggedBy: 'Project Supervisor',
  loggedAt: '4:15 PM today',
};

export const DEFAULT_WEATHER_ALERT: WeatherAlert = {
  title: 'Heavy Rain Warning',
  message: 'Aug 9–10 forecast shows high precipitation risk. Delay concrete slab casting to Aug 11 to avoid structural honeycombing.',
  location: 'Indiranagar',
};

export const DEFAULT_CUSTOMER_NAME = 'Yeruva';
