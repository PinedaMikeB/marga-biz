(function () {
    function initHeroStage() {
        var stage = document.getElementById('hero-stage');
        if (!stage) return;

        var beats = Array.prototype.slice.call(stage.querySelectorAll('.as-hero-beat'));
        var steps = Array.prototype.slice.call(stage.querySelectorAll('.as-hero-step'));
        var progressBar = document.getElementById('hero-progress-bar');
        var headTitle = document.getElementById('hero-head-title');
        var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var isMobile = window.matchMedia('(max-width: 900px)').matches;
        var motionScale = reducedMotion ? 1.6 : 1;

        var sequence = [
            { id: 'inquiry', ms: (isMobile ? 3500 : 4000) * motionScale, head: 'SecureView CCTV · Active now' },
            { id: 'quote', ms: (isMobile ? 3500 : 4000) * motionScale, head: 'SecureView CCTV · Active now' },
            { id: 'paid', ms: (isMobile ? 2500 : 3000) * motionScale, head: 'SecureView CCTV · Active now' },
            { id: 'dashboard', ms: (isMobile ? 4500 : 5000) * motionScale, head: 'AIStaff · SecureView' },
            { id: 'roi', ms: (isMobile ? 4500 : 5000) * motionScale, head: 'AIStaff · SecureView' }
        ];

        var index = 0;
        var paused = false;
        var timer = null;
        var progressRaf = null;
        var beatStart = 0;

        function findBeat(id) {
            for (var i = 0; i < beats.length; i += 1) {
                if (beats[i].dataset.beat === id) return beats[i];
            }
            return null;
        }

        function setBeat(i) {
            index = i;
            var current = sequence[index];
            beats.forEach(function (beat) {
                beat.classList.remove('is-active');
            });
            var activeBeat = findBeat(current.id);
            if (activeBeat) {
                void activeBeat.offsetWidth;
                activeBeat.classList.add('is-active');
            }
            steps.forEach(function (step) {
                var active = step.dataset.step === current.id;
                step.classList.toggle('is-active', active);
                step.setAttribute('aria-selected', active ? 'true' : 'false');
            });
            if (headTitle) headTitle.textContent = current.head;
        }

        function runProgress(duration) {
            if (!progressBar) return;
            if (progressRaf) cancelAnimationFrame(progressRaf);
            beatStart = performance.now();
            progressBar.style.width = '0%';

            function tick(now) {
                if (paused) {
                    progressRaf = requestAnimationFrame(tick);
                    return;
                }
                var pct = Math.min(100, ((now - beatStart) / duration) * 100);
                progressBar.style.width = pct + '%';
                if (pct < 100) progressRaf = requestAnimationFrame(tick);
            }

            progressRaf = requestAnimationFrame(tick);
        }

        function scheduleNext() {
            clearTimeout(timer);
            var duration = sequence[index].ms;
            runProgress(duration);
            timer = setTimeout(function () {
                if (paused) {
                    scheduleNext();
                    return;
                }
                setBeat((index + 1) % sequence.length);
                scheduleNext();
            }, duration);
        }

        setBeat(0);
        scheduleNext();

        stage.addEventListener('mouseenter', function () { paused = true; });
        stage.addEventListener('mouseleave', function () {
            paused = false;
            if (progressBar) {
                beatStart = performance.now() - (parseFloat(progressBar.style.width) / 100) * sequence[index].ms;
            }
        });

        document.documentElement.dataset.aistaffHero = 'v2';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeroStage);
    } else {
        initHeroStage();
    }
})();
