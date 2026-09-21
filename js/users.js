/* ============================================================
   users.js — قائمة المستخدمين (اسم مستخدم + مِلح + هاش SHA-256)
   لا تُخزَّن كلمات المرور نصاً صريحاً إطلاقاً.
   لتوليد مِلح وهاش جديدين افتح tools/hash.html
   ============================================================ */
'use strict';

const USERS = [
    {
        username: 'chairman',
        role: 'chairman',
        name: 'رئيس الهيئة',
        pages: ['chairman.html', 'deputy.html'],
        salt: 'fbc4582ab98ef6de',
        hash: '88fae289e0f9a76bceda59006ec1ef15e1e9277b90bbe4125835a1d0add9351e'
    },
    {
        username: 'deputy',
        role: 'deputy',
        name: 'نائب الرئيس',
        pages: ['deputy.html'],
        salt: '375fbc3ac2ac35c6',
        hash: 'd0ce66cf09793b23013d6dcc8afe0bab24e337d7c8f5b4ec9f9e5f60d1fae8c4'
    },
    {
        username: 'admin',
        role: 'chairman',
        name: 'مدير النظام',
        pages: ['chairman.html', 'deputy.html'],
        salt: '66ea2853f5cdd2c6',
        hash: 'af217391725a60dcf512da033e8bf9badb16e20eb02562a897f84df035fc8c49'
    }
];