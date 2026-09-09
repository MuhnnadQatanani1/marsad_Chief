const VALID_USER = {
    username: 'admin',
    password: '123456'
};

function togglePassword() {
    const passInput = document.getElementById('password');
    const eyeIcon = document.getElementById('eyeIcon');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.classList.remove('bi-eye');
        eyeIcon.classList.add('bi-eye-slash');
    } else {
        passInput.type = 'password';
        eyeIcon.classList.remove('bi-eye-slash');
        eyeIcon.classList.add('bi-eye');
    }
}

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const userError = document.getElementById('userError');
    const passError = document.getElementById('passError');
    const card = document.querySelector('.login-card');

    userError.textContent = '';
    passError.textContent = '';
    document.getElementById('username').classList.remove('error');
    document.getElementById('password').classList.remove('error');

    let hasError = false;

    if (!username) {
        userError.textContent = 'يرجى إدخال اسم المستخدم';
        document.getElementById('username').classList.add('error');
        hasError = true;
    }

    if (!password) {
        passError.textContent = 'يرجى إدخال كلمة المرور';
        document.getElementById('password').classList.add('error');
        hasError = true;
    }

    if (hasError) {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);
        return;
    }

    if (username === VALID_USER.username && password === VALID_USER.password) {
        localStorage.setItem('authenticated', 'true');
        localStorage.setItem('loginTime', new Date().toISOString());
        window.location.href = 'dashboard.html';
    } else {
        userError.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
        document.getElementById('username').classList.add('error');
        document.getElementById('password').classList.add('error');
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);
    }
});

if (localStorage.getItem('authenticated') === 'true') {
    window.location.href = 'dashboard.html';
}
