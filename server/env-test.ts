import dotenv from 'dotenv';
dotenv.config();

console.log('Environment variables:');
console.log('HOST_5:', process.env.HOST_5);
console.log('CISCO_USER_5:', process.env.CISCO_USER_5 ? '***' : undefined);
console.log('PASSWORD_5:', process.env.PASSWORD_5 ? '***' : undefined);