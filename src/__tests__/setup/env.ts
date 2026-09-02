process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.AMQP_URL ??= "amqp://test:test@localhost:5672";
process.env.PAYSTACK_SECRET_KEY ??= "sk_test_dummy";
process.env.PAYSTACK_URL ??= "https://api.paystack.test";
