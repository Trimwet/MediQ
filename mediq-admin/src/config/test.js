import { requiredPermissionFor } from './rbac.js';
console.log('Permission for /admin/staff:', requiredPermissionFor('/admin/staff'));