// ===== Landing page logic =====
document.addEventListener('DOMContentLoaded', () => {
  // Generate twinkling stars
  const starsContainer = document.getElementById('stars');
  const starCount = window.innerWidth < 640 ? 50 : 90;
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.left = Math.random() * 100 + '%';
    star.style.top = Math.random() * 100 + '%';
    star.style.animationDelay = Math.random() * 4 + 's';
    star.style.animationDuration = (3 + Math.random() * 4) + 's';
    starsContainer.appendChild(star);
  }

  // Enter button → smooth transition to login
  const enterBtn = document.getElementById('enter-btn');
  const page = document.getElementById('landing-page');
  enterBtn.addEventListener('click', () => {
    page.classList.add('exiting');
    setTimeout(() => { window.location.href = 'login.html'; }, 480);
  });

  // Subtle parallax on mouse move (desktop only)
  if (window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      document.querySelectorAll('.orb').forEach((orb, i) => {
        const mult = [1, -1.2, 0.7][i] || 1;
        orb.style.transform = `translate(${x * mult}px, ${y * mult}px)`;
      });
    });
  }
});