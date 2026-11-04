// The button under the latest version's demo plays FIRTACH's boot-up sound.
(function () {
  const button = document.querySelector('[data-boot-sound]');
  if (!button) return;

  const sound = new Audio(button.dataset.bootSound);
  sound.preload = 'none';

  const show = (label) => { button.textContent = label; };

  button.addEventListener('click', () => {
    if (sound.paused) {
      sound.currentTime = 0;
      sound.play().catch(() => show('Sound unavailable'));
    } else {
      sound.pause();
      show('Play boot-up sound');
    }
  });

  sound.addEventListener('playing', () => show('Stop boot-up sound'));
  sound.addEventListener('ended', () => show('Play boot-up sound'));
})();
