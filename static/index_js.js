document.addEventListener("DOMContentLoaded", function () {
    const videoContainer = document.getElementById("video-container");
    const landingPage = document.getElementById("landing-page");
    const desc = document.querySelector('.desc');
    const actionButtons = document.querySelectorAll(".action-button");
    const actionButtona = document.querySelectorAll(".action-button-a")
    if (videoContainer) {
        videoContainer.addEventListener("animationend", function () {
            videoContainer.style.display = "none";
            landingPage.style.opacity = "1";
            document.body.style.overflow = "auto";
            AOS.init({
                duration: 100,
                once: false
            });
        });
    }

    desc.addEventListener('mousemove', (e) => {
        const rect = desc.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 70;
        const rotateY = (x - centerX) / 70;

        desc.style.transition = 'none';
        desc.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        desc.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(209, 81, 223, 0.1) 5px, rgba(119, 104, 226, 0) 350px)`;

        let glowSide = '';
        const distFromLeft = x;
        const distFromRight = rect.width - x;
        const distFromTop = y;
        const distFromBottom = rect.height - y;
        const minDist = Math.min(distFromLeft, distFromRight, distFromTop, distFromBottom);

        if (minDist === distFromLeft) glowSide = 'left';
        else if (minDist === distFromRight) glowSide = 'right';
        else if (minDist === distFromTop) glowSide = 'top';
        else glowSide = 'bottom';

        desc.setAttribute('data-glow-side', glowSide);
    });

    desc.addEventListener('mouseleave', () => {
        desc.removeAttribute('data-glow-side');
        desc.style.transition = 'transform 0.3s ease, background 0.3s ease';
        desc.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
        desc.style.background = 'radial-gradient(circle, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0))';
    });

    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    function scrambleText(element, finalText, duration = 1000) {
        let startTime = null;
        const totalLength = finalText.length;
        const charDuration = duration / totalLength;

        function updateText(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const revealedChars = Math.min(Math.floor(progress / charDuration), totalLength);

            let scrambled = '';
            for (let i = 0; i < totalLength; i++) {
                scrambled += i < revealedChars ? finalText[i] : characters[Math.floor(Math.random() * characters.length)];
            }

            element.textContent = scrambled;

            if (revealedChars < totalLength) {
                requestAnimationFrame(updateText);
            } else {
                element.textContent = finalText;
            }
        }

        element.textContent = Array(totalLength).fill('').map(() => characters[Math.floor(Math.random() * characters.length)]).join('');
        requestAnimationFrame(updateText);
    }
    

    actionButtona.forEach(button =>{
        const originalButtonText = button.textContent.trim();
        button.addEventListener("mouseenter",(e) => {
            scrambleText(button, originalButtonText, 1000);
        });
    })




    actionButtons.forEach(button => {
        const descElement = button.parentElement.querySelector(".button-desc");
        const descText = button.getAttribute("data-desc");
        const originalButtonText = button.textContent.trim();
        const buttonContainer = button.closest('.button-container');

        if (descElement && descText) {
            descElement.textContent = descText;
        }

        button.addEventListener("mouseenter", () => {
            scrambleText(button, originalButtonText, 1000);
            descElement.style.opacity = "1";
            descElement.style.visibility = "visible";
            descElement.style.transform = "translateY(0)";
        });

        button.addEventListener("mouseleave", () => {
            button.textContent = originalButtonText;
            buttonContainer.classList.remove('active');
            descElement.style.opacity = "0";
            descElement.style.visibility = "hidden";
            descElement.style.transform = "translateY(10px)";
        });

        button.addEventListener("click", (e) => {
            e.preventDefault();
            const isActive = buttonContainer.classList.contains('active');
            document.querySelectorAll('.button-container').forEach(container => container.classList.remove('active'));

            if (!isActive) {
                buttonContainer.classList.add('active');
                scrambleText(button, originalButtonText, 1000);
                descElement.style.opacity = "1";
                descElement.style.visibility = "visible";
                descElement.style.transform = "translateY(0)";
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.button-container')) {
            document.querySelectorAll('.button-container').forEach(container => container.classList.remove('active'));
        }
    });

    
});
