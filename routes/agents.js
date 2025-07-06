const express = require('express');
const { body, validationResult, query } = require('express-validator');
const User = require('../models/User');
const Property = require('../models/Property');
const { protect, requireAgent, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/agents
// @desc    Get all agents with pagination and filtering
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('specialization').optional().isIn(['residential', 'commercial', 'land', 'luxury', 'rental']),
  query('city').optional().isString(),
  query('minRating').optional().isFloat({ min: 0, max: 5 }),
  query('sortBy').optional().isIn(['rating', 'experience', 'transactions', 'createdAt']),
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
    const filter = { 
      isAgent: true, 
      isActive: true,
      'agentProfile.isVerified': true 
    };

    if (req.query.specialization) {
      filter['agentProfile.specialization'] = req.query.specialization;
    }

    if (req.query.city) {
      filter['agentProfile.address.city'] = new RegExp(req.query.city, 'i');
    }

    if (req.query.minRating) {
      filter['agentProfile.rating.average'] = { $gte: parseFloat(req.query.minRating) };
    }

    // Search by name
    if (req.query.search) {
      filter.name = new RegExp(req.query.search, 'i');
    }

    // Build sort object
    let sort = {};
    if (req.query.sortBy) {
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      if (req.query.sortBy === 'rating') {
        sort['agentProfile.rating.average'] = sortOrder;
      } else if (req.query.sortBy === 'experience') {
        sort['agentProfile.experience'] = sortOrder;
      } else if (req.query.sortBy === 'transactions') {
        sort['agentProfile.totalTransactions'] = sortOrder;
      } else {
        sort[req.query.sortBy] = sortOrder;
      }
    } else {
      sort = { 'agentProfile.rating.average': -1, 'agentProfile.totalTransactions': -1 };
    }

    // Execute query
    const agents = await User.find(filter)
      .select('name email agentProfile createdAt')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: agents.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      agents
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/agents/top
// @desc    Get top-rated agents
// @access  Public
router.get('/top', optionalAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 6;

    const agents = await User.find({
      isAgent: true,
      isActive: true,
      'agentProfile.isVerified': true,
      'agentProfile.rating.count': { $gte: 1 } // At least one rating
    })
    .select('name email agentProfile createdAt')
    .sort({ 
      'agentProfile.rating.average': -1, 
      'agentProfile.totalTransactions': -1 
    })
    .limit(limit)
    .lean();

    res.status(200).json({
      success: true,
      count: agents.length,
      agents
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/agents/:id
// @desc    Get single agent profile
// @access  Public
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const agent = await User.findOne({
      _id: req.params.id,
      isAgent: true,
      isActive: true
    }).select('name email agentProfile createdAt');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Get agent's recent properties
    const recentProperties = await Property.find({
      agent: req.params.id,
      status: 'active'
    })
    .select('title type price address images createdAt')
    .sort({ createdAt: -1 })
    .limit(6)
    .lean();

    // Get agent stats
    const totalProperties = await Property.countDocuments({
      agent: req.params.id
    });

    const activeProperties = await Property.countDocuments({
      agent: req.params.id,
      status: 'active'
    });

    const soldProperties = await Property.countDocuments({
      agent: req.params.id,
      status: { $in: ['sold', 'rented'] }
    });

    res.status(200).json({
      success: true,
      agent,
      properties: recentProperties,
      stats: {
        totalProperties,
        activeProperties,
        soldProperties
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/agents/:id/properties
// @desc    Get agent's properties with pagination
// @access  Public
router.get('/:id/properties', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['draft', 'active', 'pending', 'sold', 'rented', 'inactive'])
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

    const filter = { agent: req.params.id };
    
    // Only show active properties to non-owners
    if (!req.user || req.user.id !== req.params.id) {
      filter.status = 'active';
    } else if (req.query.status) {
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

// @route   PUT /api/agents/profile
// @desc    Update agent profile
// @access  Private (Agents only)
router.put('/profile', protect, requireAgent, [
  body('experience').optional().isInt({ min: 0 }).withMessage('Experience must be a positive number'),
  body('specialization').optional().isArray({ min: 1 }).withMessage('At least one specialization is required'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  body('phone').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Please enter a valid phone number')
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

    const allowedFields = [
      'experience', 'specialization', 'bio', 'phone', 'address'
    ];

    const updateFields = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields[`agentProfile.${key}`] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    ).select('name email agentProfile');

    res.status(200).json({
      success: true,
      message: 'Agent profile updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/agents/:id/rate
// @desc    Rate an agent
// @access  Private
router.post('/:id/rate', protect, [
  body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters')
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

    const agent = await User.findOne({
      _id: req.params.id,
      isAgent: true,
      isActive: true
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot rate yourself'
      });
    }

    // Update agent rating
    await agent.updateRating(parseFloat(req.body.rating));

    res.status(200).json({
      success: true,
      message: 'Rating submitted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/agents/dashboard/stats
// @desc    Get agent dashboard statistics
// @access  Private (Agents only)
router.get('/dashboard/stats', protect, requireAgent, async (req, res, next) => {
  try {
    const agentId = req.user.id;

    // Get property statistics
    const totalProperties = await Property.countDocuments({ agent: agentId });
    const activeProperties = await Property.countDocuments({ 
      agent: agentId, 
      status: 'active' 
    });
    const soldProperties = await Property.countDocuments({ 
      agent: agentId, 
      status: { $in: ['sold', 'rented'] }
    });
    const draftProperties = await Property.countDocuments({ 
      agent: agentId, 
      status: 'draft' 
    });

    // Get total views for all properties
    const viewsResult = await Property.aggregate([
      { $match: { agent: req.user._id } },
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);
    const totalViews = viewsResult.length > 0 ? viewsResult[0].totalViews : 0;

    // Get total inquiries
    const inquiriesResult = await Property.aggregate([
      { $match: { agent: req.user._id } },
      { $project: { inquiriesCount: { $size: '$inquiries' } } },
      { $group: { _id: null, totalInquiries: { $sum: '$inquiriesCount' } } }
    ]);
    const totalInquiries = inquiriesResult.length > 0 ? inquiriesResult[0].totalInquiries : 0;

    // Get recent inquiries
    const recentInquiries = await Property.find({ 
      agent: agentId,
      'inquiries.0': { $exists: true }
    })
    .select('title inquiries')
    .sort({ 'inquiries.createdAt': -1 })
    .limit(5)
    .lean();

    const flatInquiries = [];
    recentInquiries.forEach(property => {
      property.inquiries.forEach(inquiry => {
        flatInquiries.push({
          ...inquiry,
          propertyTitle: property.title,
          propertyId: property._id
        });
      });
    });

    flatInquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const recentInquiriesLimited = flatInquiries.slice(0, 5);

    res.status(200).json({
      success: true,
      stats: {
        totalProperties,
        activeProperties,
        soldProperties,
        draftProperties,
        totalViews,
        totalInquiries,
        rating: req.user.agentProfile.rating,
        totalTransactions: req.user.agentProfile.totalTransactions
      },
      recentInquiries: recentInquiriesLimited
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/agents/search/nearby
// @desc    Find nearby agents
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

    // Note: This would require geographic indexing on agent addresses
    // For now, we'll return agents sorted by rating
    const agents = await User.find({
      isAgent: true,
      isActive: true,
      'agentProfile.isVerified': true
    })
    .select('name email agentProfile')
    .sort({ 'agentProfile.rating.average': -1 })
    .limit(10)
    .lean();

    res.status(200).json({
      success: true,
      count: agents.length,
      agents
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;