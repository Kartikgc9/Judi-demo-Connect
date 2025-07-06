const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Contact = require('../models/Contact');
const { protect, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/contact
// @desc    Submit contact form
// @access  Public
router.post('/', [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('subject').trim().isLength({ min: 5, max: 100 }).withMessage('Subject must be between 5 and 100 characters'),
  body('message').isLength({ min: 10, max: 1000 }).withMessage('Message must be between 10 and 1000 characters'),
  body('phone').optional().matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Please enter a valid phone number'),
  body('type').optional().isIn(['general', 'property_inquiry', 'agent_inquiry', 'support', 'partnership'])
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

    const { name, email, phone, subject, message, type = 'general' } = req.body;

    const contactData = {
      name,
      email,
      phone,
      subject,
      message,
      type,
      source: 'website'
    };

    const contact = await Contact.create(contactData);

    // TODO: Send email notification to admin
    // await sendContactNotification(contact);

    res.status(201).json({
      success: true,
      message: 'Thank you for contacting us. We will get back to you soon.',
      contact: {
        id: contact._id,
        name: contact.name,
        subject: contact.subject,
        createdAt: contact.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/contact
// @desc    Get all contact submissions (Admin only)
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('status').optional().isIn(['new', 'in_progress', 'resolved', 'closed']),
  query('type').optional().isIn(['general', 'property_inquiry', 'agent_inquiry', 'support', 'partnership']),
  query('priority').optional().isIn(['low', 'medium', 'high'])
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

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.priority) filter.priority = req.query.priority;

    // Search by name, email, or subject
    if (req.query.search) {
      filter.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') },
        { subject: new RegExp(req.query.search, 'i') }
      ];
    }

    // Execute query
    const contacts = await Contact.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await Contact.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: contacts.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      contacts
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/contact/:id
// @desc    Get single contact submission
// @access  Private (Admin)
router.get('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('responseNotes.addedBy', 'name email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    // Mark as read
    if (!contact.isRead) {
      contact.isRead = true;
      await contact.save();
    }

    res.status(200).json({
      success: true,
      contact
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/contact/:id
// @desc    Update contact submission
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
  body('status').optional().isIn(['new', 'in_progress', 'resolved', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('assignedTo').optional().isMongoId().withMessage('Invalid user ID')
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

    const allowedFields = ['status', 'priority', 'assignedTo'];
    const updateFields = {};

    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields[key] = req.body[key];
      }
    });

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Contact submission updated successfully',
      contact
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/contact/:id/notes
// @desc    Add response note to contact submission
// @access  Private (Admin)
router.post('/:id/notes', protect, authorize('admin'), [
  body('note').isLength({ min: 1, max: 1000 }).withMessage('Note must be between 1 and 1000 characters')
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

    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    contact.responseNotes.push({
      note: req.body.note,
      addedBy: req.user.id
    });

    await contact.save();

    const updatedContact = await Contact.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('responseNotes.addedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Note added successfully',
      contact: updatedContact
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/contact/:id
// @desc    Delete contact submission
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact submission not found'
      });
    }

    await Contact.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Contact submission deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/contact/stats/dashboard
// @desc    Get contact statistics for admin dashboard
// @access  Private (Admin)
router.get('/stats/dashboard', protect, authorize('admin'), async (req, res, next) => {
  try {
    const totalContacts = await Contact.countDocuments();
    const newContacts = await Contact.countDocuments({ status: 'new' });
    const inProgressContacts = await Contact.countDocuments({ status: 'in_progress' });
    const resolvedContacts = await Contact.countDocuments({ status: 'resolved' });
    const highPriorityContacts = await Contact.countDocuments({ priority: 'high' });

    // Get contacts by type
    const contactsByType = await Contact.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent contacts
    const recentContacts = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email subject type status createdAt');

    res.status(200).json({
      success: true,
      stats: {
        totalContacts,
        newContacts,
        inProgressContacts,
        resolvedContacts,
        highPriorityContacts,
        contactsByType,
        recentContacts
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;