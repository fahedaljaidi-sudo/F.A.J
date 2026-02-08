const Joi = require('joi');

const schemas = {
    login: Joi.object({
        username: Joi.string().required().messages({
            'string.empty': 'اسم المستخدم مطلوب',
            'any.required': 'اسم المستخدم مطلوب'
        }),
        password: Joi.string().required().messages({
            'string.empty': 'كلمة المرور مطلوبة',
            'any.required': 'كلمة المرور مطلوبة'
        })
    }),
    
    createUser: Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        password: Joi.string().min(6).required(),
        full_name: Joi.string().required(),
        email: Joi.string().email().allow(null, ''),
        role: Joi.string().valid('admin', 'supervisor', 'guard', 'operations_manager', 'hr_manager', 'safety_officer').default('guard'),
        unit_number: Joi.string().allow(null, '')
    }),

    createPatrol: Joi.object({
        location: Joi.string().required(),
        security_status: Joi.string().valid('normal', 'observation', 'danger').required(),
        notes: Joi.string().allow(null, ''),
        attachments: Joi.string().allow(null, ''),
        image: Joi.string().allow(null, '') // Allow base64 image
    }),

    createVisitor: Joi.object({
        full_name: Joi.string().required(),
        id_number: Joi.string().required(),
        phone: Joi.string().allow(null, ''),
        company: Joi.string().allow(null, ''),
        host_name: Joi.string().allow(null, ''),
        visit_reason: Joi.string().allow(null, ''),
        gate_number: Joi.string().default('1'),
        notes: Joi.string().allow(null, '')
    })
};

const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
        
        if (error) {
            const errorMessage = error.details.map(detail => detail.message).join(', ');
            return res.status(400).json({ error: errorMessage });
        }
        
        next();
    };
};

module.exports = { schemas, validate };
