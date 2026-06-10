from django.core.management.base import BaseCommand

from orders.models import Category, Product


MENU = [
    {
        "name": "Essential Spices",
        "tamil_name": "அடிப்படை மசாலா பொடிகள்",
        "icon": "🌶️",
        "description": "Pure powders to enhance your daily cooking.",
        "tamil_description": "சமையலின் சுவையை அதிகரிக்கும் சுத்தமான பொடிகள்.",
        "products": [
            ("Turmeric Powder", "மஞ்சள் தூள்", 280, "", "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?auto=format&fit=crop&w=900&q=80"),
            ("Chili Powder", "மிளகாய்த் தூள்", 280, "", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=80"),
            ("Coriander Powder", "மல்லித் தூள்", 220, "", "https://images.unsplash.com/photo-1607877742574-a15a9ecdf5c4?auto=format&fit=crop&w=900&q=80"),
            ("Sambar Powder", "சாம்பார் தூள்", 350, "", "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=900&q=80"),
        ],
    },
    {
        "name": "Traditional Curry & Rasam Mixes",
        "tamil_name": "குழம்பு மற்றும் ரச வகைகள்",
        "icon": "🍲",
        "description": "The authentic taste of home in every spoon.",
        "tamil_description": "ஒவ்வொரு கரண்டியிலும் வீட்டுச் சுவை.",
        "products": [
            ("Kuzhambu Varieties", "குழம்பு வகைகள்", 350, "Fish / Tamarind / Vathal / Gravy Powder", "https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=900&q=80"),
            ("Rasam Varieties", "ரசப் பொடி வகைகள்", 350, "Standard Rasam / Horse Gram Rasam", "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80"),
            ("Multi-Masala", "மல்டி மசாலா", 400, "Veg & Non-Veg", "https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=900&q=80"),
        ],
    },
    {
        "name": "Breakfast & Rice Podis",
        "tamil_name": "இட்லி மற்றும் சாதப் பொடிகள்",
        "icon": "🍚",
        "description": "Perfect side dishes for Idli, Dosa, and Rice.",
        "tamil_description": "இட்லி, தோசை, சாதத்திற்கு சிறந்த துணை.",
        "products": [
            ("Idli Podi / Lentil Podi", "இட்லி பொடி / பருப்புப் பொடி", 350, "", "https://images.unsplash.com/photo-1630409351217-bc4fa6422075?auto=format&fit=crop&w=900&q=80"),
            ("Curry Leaf Podi", "கருவேப்பிலை பொடி", 400, "", "https://images.unsplash.com/photo-1628557044797-f21a177c37ec?auto=format&fit=crop&w=900&q=80"),
        ],
    },
    {
        "name": "Health & Wellness Mixes",
        "tamil_name": "ஆரோக்கியம் மற்றும் உடனடி உணவுகள்",
        "icon": "💪",
        "description": "Nutritious blends for a healthy lifestyle.",
        "tamil_description": "ஆரோக்கியமான வாழ்க்கைக்கான சத்தான கலவைகள்.",
        "products": [
            ("Health Mix Powder", "20 வகை தானிய சத்துமாவு", 250, "20 types of millets", "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=900&q=80"),
            ("Fiber & Iron Rich Health Mix", "நார்ச்சத்து & இரும்புச்சத்து மாவு", 400, "", "https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?auto=format&fit=crop&w=900&q=80"),
            ("Ready-to-use Bajji Mix", "உடனடி பஜ்ஜி மாவு", 200, "", "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=900&q=80"),
        ],
    },
    {
        "name": "Freshly Ground Flours",
        "tamil_name": "இதர மாவு வகைகள்",
        "icon": "🌾",
        "description": "Ragi | Wheat | Barley | All other varieties available on request.",
        "tamil_description": "ராகி | கோதுமை | பார்லி | அனைத்து வகை மாவு.",
        "products": [
            ("Fresh Flour Varieties", "தரமான மாவு வகைகள்", 0, "Price confirmed after request.", "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=900&q=80"),
        ],
    },
]


class Command(BaseCommand):
    help = "Seed ANNAI HEALTH MASALA menu categories and products."

    def handle(self, *args, **options):
        for category_index, category_data in enumerate(MENU, start=1):
            category, _created = Category.objects.update_or_create(
                name=category_data["name"],
                defaults={
                    "tamil_name": category_data["tamil_name"],
                    "icon": category_data["icon"],
                    "description": category_data["description"],
                    "tamil_description": category_data["tamil_description"],
                    "sort_order": category_index,
                },
            )
            for product_index, product in enumerate(category_data["products"], start=1):
                name, tamil_name, price, description, image_url = product
                Product.objects.update_or_create(
                    name=name,
                    category=category,
                    defaults={
                        "tamil_name": tamil_name,
                        "description": description,
                        "price_per_kg": price,
                        "image_url": image_url,
                        "sort_order": product_index,
                        "is_available": True,
                    },
                )
        self.stdout.write(self.style.SUCCESS("Menu seeded successfully."))
