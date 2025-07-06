const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Property title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Property description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  type: {
    type: String,
    required: [true, 'Property type is required'],
    enum: ['apartment', 'house', 'condo', 'townhouse', 'land', 'commercial', 'office', 'warehouse']
  },
  listingType: {
    type: String,
    required: [true, 'Listing type is required'],
    enum: ['sale', 'rent', 'lease']
  },
  price: {
    amount: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR'
    },
    priceType: {
      type: String,
      enum: ['total', 'per_month', 'per_year', 'per_sqft'],
      default: 'total'
    }
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'Zip code is required']
    },
    country: {
      type: String,
      default: 'India'
    },
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      }
    }
  },
  specifications: {
    bedrooms: {
      type: Number,
      min: 0,
      default: 0
    },
    bathrooms: {
      type: Number,
      min: 0,
      default: 0
    },
    area: {
      value: {
        type: Number,
        required: [true, 'Property area is required'],
        min: [1, 'Area must be positive']
      },
      unit: {
        type: String,
        enum: ['sqft', 'sqm', 'acres', 'hectares'],
        default: 'sqft'
      }
    },
    floors: {
      type: Number,
      min: 0
    },
    parking: {
      type: Number,
      min: 0,
      default: 0
    },
    furnished: {
      type: String,
      enum: ['unfurnished', 'semi-furnished', 'fully-furnished'],
      default: 'unfurnished'
    },
    yearBuilt: {
      type: Number,
      min: 1800,
      max: new Date().getFullYear() + 5
    }
  },
  amenities: [{
    type: String,
    enum: [
      'swimming_pool', 'gym', 'garden', 'balcony', 'elevator', 'security',
      'power_backup', 'water_supply', 'internet', 'ac', 'heating',
      'parking', 'playground', 'clubhouse', 'laundry', 'storage'
    ]
  }],
  images: [{
    public_id: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Agent is required']
  },
  contactInfo: {
    phone: {
      type: String,
      required: [true, 'Contact phone is required'],
      match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
    },
    email: {
      type: String,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    whatsapp: String
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'pending', 'sold', 'rented', 'inactive'],
    default: 'draft'
  },
  featured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  inquiries: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    phone: String,
    email: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  // SEO and search optimization
  tags: [String],
  seoTitle: String,
  seoDescription: String,
  
  // Verification and quality
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationDocuments: [{
    type: String,
    url: String,
    documentType: {
      type: String,
      enum: ['ownership', 'noc', 'approval', 'tax_receipt', 'other']
    }
  }],
  
  // Analytics
  analytics: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    saves: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
propertySchema.index({ 'address.city': 1, 'address.state': 1 });
propertySchema.index({ type: 1, listingType: 1 });
propertySchema.index({ 'price.amount': 1 });
propertySchema.index({ status: 1, featured: -1 });
propertySchema.index({ agent: 1 });
propertySchema.index({ createdAt: -1 });
propertySchema.index({ 'address.coordinates': '2dsphere' });

// Virtual for formatted price
propertySchema.virtual('formattedPrice').get(function() {
  const { amount, currency, priceType } = this.price;
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR'
  });
  
  let formattedAmount = formatter.format(amount);
  
  switch(priceType) {
    case 'per_month':
      return `${formattedAmount}/month`;
    case 'per_year':
      return `${formattedAmount}/year`;
    case 'per_sqft':
      return `${formattedAmount}/sqft`;
    default:
      return formattedAmount;
  }
});

// Virtual for full address
propertySchema.virtual('fullAddress').get(function() {
  return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}`;
});

// Method to increment views
propertySchema.methods.incrementViews = function() {
  this.views += 1;
  this.analytics.impressions += 1;
  return this.save();
};

// Method to add inquiry
propertySchema.methods.addInquiry = function(inquiryData) {
  this.inquiries.push(inquiryData);
  return this.save();
};

// Static method to find nearby properties
propertySchema.statics.findNearby = function(longitude, latitude, maxDistance = 10000) {
  return this.find({
    'address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

module.exports = mongoose.model('Property', propertySchema);