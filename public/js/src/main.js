import ClipBoard from "clipboard";

(function () {
    initBurgerMenu();
    initClipboard();
})();

function initClipboard() {
    const clipboard = new ClipBoard('.clipboard-button');
    clipboard.on('success', function (e) {

        const animatedClasses = ['animated', 'bounceIn'];
        e.trigger.classList.add(animatedClasses[0]);
        e.trigger.classList.add(animatedClasses[1]);
        const originalText = e.trigger.dataset.balloon;
        e.trigger.dataset.balloon = 'Copied';

        window.setTimeout(function () {
            e.trigger.dataset.balloon = originalText;
            e.trigger.classList.remove(animatedClasses[0]);
            e.trigger.classList.remove(animatedClasses[1]);
        }, 2000);

    });


}

function initBurgerMenu() {
    // The following code is based off a toggle menu by @Bradcomp
    // source: https://gist.github.com/Bradcomp/a9ef2ef322a8e8017443b626208999c1
    const burger = document.querySelector('.burger');
    const menu = document.querySelector('#' + burger.dataset.target);
    burger.addEventListener('click', function () {
        burger.classList.toggle('is-active');
        menu.classList.toggle('is-active');
    });
}

