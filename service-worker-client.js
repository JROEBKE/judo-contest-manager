if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(registration => {
        const notice = document.getElementById('updateNotice');
        const reloadButton = document.getElementById('reloadAfterFight');
        let alreadyControlled = Boolean(navigator.serviceWorker.controller);

        const showUpdateNotice = () => {
          notice.hidden = false;
        };

        reloadButton.addEventListener('click', () => {
          window.location.reload();
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if(alreadyControlled) showUpdateNotice();
          alreadyControlled = true;
        });

        if(registration.waiting && navigator.serviceWorker.controller){
          showUpdateNotice();
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if(!installing) return;

          installing.addEventListener('statechange', () => {
            if(installing.state === 'installed' && navigator.serviceWorker.controller){
              showUpdateNotice();
            }
          });
        });
      })
      .catch(error => console.error('Service Worker konnte nicht registriert werden:', error));
  });
}
