export const menuCategories = [
  {
    id: "spices",
    icon: "🌶️",
    name: "Essential Spices",
    tamilName: "அடிப்படை மசாலா பொடிகள்",
    description: "Pure powders to enhance your daily cooking.",
    tamilDescription: "சமையலின் சுவையை அதிகரிக்கும் சுத்தமான பொடிகள்.",
    products: [
      {
        id: 1,
        name: "Turmeric Powder",
        tamilName: "மஞ்சள் தூள்",
        price: 280,
        image: "/turmeric.jpg",
      },
      {
        id: 2,
        name: "Chili Powder",
        tamilName: "மிளகாய்த் தூள்",
        price: 280,
        image: "/redchill.png",
      },
      {
        id: 3,
        name: "Coriander Powder",
        tamilName: "மல்லித் தூள்",
        price: 220,
        image: "/coriander.jpg",
      },
      {
        id: 4,
        name: "Sambar Powder",
        tamilName: "சாம்பார் தூள்",
        price: 350,
        image:
          "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "curry-rasam",
    icon: "🍲",
    name: "Traditional Curry & Rasam Mixes",
    tamilName: "குழம்பு மற்றும் ரச வகைகள்",
    description: "The authentic taste of home in every spoon.",
    tamilDescription: "ஒவ்வொரு கரண்டியிலும் வீட்டுச் சுவை.",
    products: [
      {
        id: 5,
        name: "Kuzhambu Varieties",
        tamilName: "குழம்பு வகைகள்",
        price: 350,
        description: "Fish / Tamarind / Vathal / Gravy Powder",
        tamilDescription: "மீன் / புளி / வத்தல் குழம்பு / குழம்புப் பொடி",
        image:
          "https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: 6,
        name: "Rasam Varieties",
        tamilName: "ரசப் பொடி வகைகள்",
        price: 350,
        description: "Standard Rasam / Horse Gram Rasam",
        tamilDescription: "சாதாரண ரசம் / கொள்ளு ரசப்பொடி",
        image:
          "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80",
      },
      {
        id: 7,
        name: "Multi-Masala",
        tamilName: "மல்டி மசாலா",
        price: 400,
        description: "Veg & Non-Veg",
        tamilDescription: "சைவம் & அசைவம்",
        image:
          "https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
  {
    id: "podi",
    icon: "🍚",
    name: "Breakfast & Rice Podis",
    tamilName: "இட்லி மற்றும் சாதப் பொடிகள்",
    description: "Perfect side dishes for Idli, Dosa, and Rice.",
    tamilDescription: "இட்லி, தோசை, சாதத்திற்கு சிறந்த துணை.",
    products: [
      {
        id: 8,
        name: "Idli Podi / Lentil Podi",
        tamilName: "இட்லி பொடி / பருப்புப் பொடி",
        price: 350,
        image: "/idlipodi.jpg",
      },
      {
        id: 9,
        name: "Curry Leaf Podi",
        tamilName: "கருவேப்பிலை பொடி",
        price: 400,
        image: "/curryleafpodi.jpg",
      },
    ],
  },
  {
    id: "health",
    icon: "💪",
    name: "Health & Wellness Mixes",
    tamilName: "ஆரோக்கியம் மற்றும் உடனடி உணவுகள்",
    description: "Nutritious blends for a healthy lifestyle.",
    tamilDescription: "ஆரோக்கியமான வாழ்க்கைக்கான சத்தான கலவைகள்.",
    products: [
      {
        id: 10,
        name: "Health Mix Powder",
        tamilName: "20 வகை தானிய சத்துமாவு",
        price: 250,
        description: "20 types of millets",
        image: "/healthmix.jpg",
      },
      {
        id: 11,
        name: "Fiber & Iron Rich Health Mix",
        tamilName: "நார்ச்சத்து & இரும்புச்சத்து மாவு",
        price: 400,
        image: "/fiberhealthmix.jpg",
      },
      {
        id: 12,
        name: "Ready-to-use Bajji Mix",
        tamilName: "உடனடி பஜ்ஜி மாவு",
        price: 200,
        image: "/bajji.png",
      },
    ],
  },
  {
    id: "flours",
    icon: "🌾",
    name: "Freshly Ground Flours",
    tamilName: "இதர மாவு வகைகள்",
    description: "Ragi | Wheat | Barley | All other varieties available on request.",
    tamilDescription: "ராகி | கோதுமை | பார்லி | அனைத்து வகை மாவு.",
    products: [
      {
        id: 13,
        name: "Fresh Flour Varieties",
        tamilName: "தரமான மாவு வகைகள்",
        price: 0,
        description: "Price confirmed after request.",
        tamilDescription: "விலை ஆர்டர் விவரத்தின் அடிப்படையில் தெரிவிக்கப்படும்.",
        image:
          "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=900&q=80",
      },
    ],
  },
];

export const flattenProducts = (categories = menuCategories) =>
  categories.flatMap((category) =>
    category.products.map((product) => ({
      ...product,
      categoryId: category.id,
      categoryName: category.name,
    })),
  );
