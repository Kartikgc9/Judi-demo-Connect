const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Property = require('../models/Property');
const { protect, requireAgent, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/properties
// @desc    Get all properties with filtering and pagination
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('type').optional().isIn(['apartment', 'house', 'condo', 'townhouse', 'land', 'commercial', 'office', 'warehouse']),
  query('listingType').optional().isIn(['sale', 'rent', 'lease']),
  query('minPrice').optional().isFloat({ min: 0 }),
  query('maxPrice').optional().isFloat({ min: 0 }),
  query('city').optional().isString(),
  query('state').optional().isString(),
  query('bedrooms').optional().isInt({ min: 0 }),
  query('bathrooms').optional().isInt({ min: 0 }),
  query('sortBy').optional().isIn(['price', 'createdAt', 'views', 'area']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], optionalAuth, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { status: 'active' };

    if (req.query.type) filter.type = req.query.type;
    if (req.query.listingType) filter.listingType = req.query.listingType;
    if (req.query.city) filter['address.city'] = new RegExp(req.query.city, 'i');
    if (req.query.state) filter['address.state'] = new RegExp(req.query.state, 'i');
    if (req.query.bedrooms) filter['specifications.bedrooms'] = { $gte: parseInt(req.query.bedrooms) };
    if (req.query.bathrooms) filter['specifications.bathrooms'] = { $gte: parseInt(req.query.bathrooms) };

    // Price filtering
    if (req.query.minPrice || req.query.maxPrice) {
      filter['price.amount'] = {};
      if (req.query.minPrice) filter['price.amount'].$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter['price.amount'].$lte = parseFloat(req.query.maxPrice);
    }

    // Search by text
    if (req.query.search) {
      filter.$or = [
        { title: new RegExp(req.query.search, 'i') },
        { description: new RegExp(req.query.search, 'i') },
        { 'address.city': new RegExp(req.query.search, 'i') },
        { 'address.state': new RegExp(req.query.search, 'i') }
      ];
    }

    // Build sort object
    let sort = {};
    if (req.query.sortBy) {
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      if (req.query.sortBy === 'price') {
        sort['price.amount'] = sortOrder;
      } else if (req.query.sortBy === 'area') {
        sort['specifications.area.value'] = sortOrder;
      } else {
        sort[req.query.sortBy] = sortOrder;
      }
    } else {
      sort = { featured: -1, createdAt: -1 }; // Default sort
    }

    // Execute query
    const properties = await Property.find(filter)
      .populate('agent', 'name agentProfile.rating agentProfile.phone agentProfile.profileImage')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Property.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: properties.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      properties
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/properties/featured
// @desc    Get featured properties
// @access  Public
router.get('/featured', optionalAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 6;

    const properties = await Property.find({ 
      status: 'active', 
      featured: true 
    })
    .populate('agent', 'name agentProfile.rating agentProfile.phone agentProfile.profileImage')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

    res.status(200).json({
      success: true,
      count: properties.length,
      properties
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/properties/:id
// @desc    Get single property
// @access  Public
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate('agent', 'name email agentProfile')
      .populate('inquiries.user', 'name email');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Increment views (but not for the property owner)
    if (!req.user || req.user.id !== property.agent._id.toString()) {
      await property.incrementViews();
    }

    res.status(200).json({
      success: true,
      property
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/properties
// @desc    Create new property
// @access  Private (Agents only)
router.post('/', protect, requireAgent, [
  body('title').trim().isLength({ min: 10, max: 100 }).withMessage('Title must be between 10 and 100 characters'),
  body('description').isLength({ min: 50, max: 2000 }).withMessage('Description must be between 50 and 2000 characters'),
  body('type').isIn(['apartment', 'house', 'condo', 'townhouse', 'land', 'commercial', 'office', 'warehouse']),
  body('listingType').isIn(['sale', 'rent', 'lease']),
  body('price.amount').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('address.street').notEmpty().withMessage('Street address is required'),
  body('address.city').notEmpty().withMessage('City is required'),
  body('address.state').notEmpty().withMessage('State is required'),
  body('address.zipCode').notEmpty().withMessage('Zip code is required'),
  body('specifications.area.value').isFloat({ min: 1 }).withMessage('Area must be a positive number'),
  body('contactInfo.phone').matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Please enter a valid phone number')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    // Add agent to the property
    req.body.agent = req.user.id;

    const property = await Property.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      property
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/properties/:id
// @desc    Update property
// @access  Private (Property owner or admin)
router.put('/:id', protect, async (req, res, next) => {
  try {
    let property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.agent.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this property'
      });
    }

    property = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('agent', 'name agentProfile.rating agentProfile.phone');

    res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      property
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/properties/:id
// @desc    Delete property
// @access  Private (Property owner or admin)
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.agent.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this property'
      });
    }

    await Property.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/properties/:id/inquiry
// @desc    Add inquiry to property
// @access  Public
router.post('/:id/inquiry', [
  body('message').isLength({ min: 10, max: 500 }).withMessage('Message must be between 10 and 500 characters'),
  body('phone').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Please enter a valid phone number'),
  body('email').optional().isEmail().withMessage('Please enter a valid email')
], optionalAuth, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const inquiryData = {
      message: req.body.message,
      phone: req.body.phone,
      email: req.body.email
    };

    if (req.user) {
      inquiryData.user = req.user.id;
    }

    await property.addInquiry(inquiryData);

    res.status(200).json({
      success: true,
      message: 'Inquiry submitted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/properties/agent/my-properties
// @desc    Get current agent's properties
// @access  Private (Agents only)
router.get('/agent/my-properties', protect, requireAgent, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { agent: req.user.id };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const properties = await Property.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Property.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: properties.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      properties
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/properties/:id/status
// @desc    Update property status
// @access  Private (Property owner or admin)
router.put('/:id/status', protect, [
  body('status').isIn(['draft', 'active', 'pending', 'sold', 'rented', 'inactive'])
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.agent.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this property'
      });
    }

    property.status = req.body.status;
    await property.save();

    res.status(200).json({
      success: true,
      message: 'Property status updated successfully',
      property
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/properties/search/nearby
// @desc    Find nearby properties
// @access  Public
router.get('/search/nearby', [
  query('longitude').isFloat().withMessage('Valid longitude is required'),
  query('latitude').isFloat().withMessage('Valid latitude is required'),
  query('maxDistance').optional().isInt({ min: 100, max: 50000 }).withMessage('Max distance must be between 100 and 50000 meters')
], optionalAuth, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { longitude, latitude, maxDistance = 10000 } = req.query;

    const properties = await Property.findNearby(
      parseFloat(longitude), 
      parseFloat(latitude), 
      parseInt(maxDistance)
    )
    .populate('agent', 'name agentProfile.rating agentProfile.phone')
    .limit(20);

    res.status(200).json({
      success: true,
      count: properties.length,
      properties
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;