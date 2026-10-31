
const { z } = require('zod');

// Password validation
const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        'Password must contain a special character'
    );

// Registration validation
const registerSchema = z.object({
    name: z.string().trim().min(1, 'Name is required'),
    email: z.string().trim().email('Enter a valid email'),
    password: passwordSchema
});

// Login validation
const loginSchema = z.object({
    email: z.string().trim().email('Enter a valid email'),
    password: z.string().min(1, 'Password is required')
});

// Forgot password validation
const forgotPasswordSchema = z.object({
    email: z.string().trim().email('Enter a valid email')
});

// Reset password validation
const resetPasswordSchema = z.object({
    email: z.string().trim().email('Enter a valid email'),
    code: z.string().optional(),
    newPassword: passwordSchema
});

module.exports = {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema
};
