import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const App = () => {
  const containerRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollSensitivity = 0.7;
  const cardsPerConcept = 5;
  const zSpacing = -400;
  const sectionGap = Math.abs(zSpacing) * 3;
  const cardSetDistance = cardsPerConcept * Math.abs(zSpacing);
  const conceptTotalDistance = cardSetDistance + sectionGap;
  const concepts = [
    { title: 'Preprocessing', cards: Array.from({ length: cardsPerConcept }, (_, i) => `Preprocessing Card ${i + 1}`) },
    { title: 'Model Training', cards: Array.from({ length: cardsPerConcept }, (_, i) => `Model Training Card ${i + 1}`) },
  ];
  const totalConcepts = concepts.length;

  const [isScrolling, setIsScrolling] = useState(false);
  const [velocityY, setVelocityY] = useState(0);
  const animationFrameId = useRef(null);
  const lastScrollTime = useRef(0);
  const decelerationRate = 0.90;

  useEffect(() => {
    const handleWheel = (event) => {
      event.preventDefault();
      setIsScrolling(true);

      const now = Date.now();
      const timeDiff = now - lastScrollTime.current;
      const delta = event.deltaY * scrollSensitivity;

      setVelocityY((prevVelocity) => prevVelocity * 0.6 + delta * 0.4);
      setScrollOffset((prevOffset) => prevOffset + delta);
      lastScrollTime.current = now;

      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };

    const handleScrollEnd = () => {
      if (Math.abs(velocityY) > 0.05) {
        animateScroll();
      }
      setIsScrolling(false);
      setVelocityY(0);
    };

    const animateScroll = () => {
      setScrollOffset((prevOffset) => prevOffset + velocityY);
      setVelocityY((prevVelocity) => prevVelocity * decelerationRate);

      animationFrameId.current = requestAnimationFrame(animateScroll);

      if (Math.abs(velocityY) < 0.005) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mouseup', handleScrollEnd);
    window.addEventListener('touchend', handleScrollEnd);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mouseup', handleScrollEnd);
      window.removeEventListener('touchend', handleScrollEnd);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [scrollSensitivity]);

  const getCurrentPosition = () => {
    const totalCycleDistance = totalConcepts * conceptTotalDistance;
    let normalizedOffset = scrollOffset % totalCycleDistance;
    if (normalizedOffset < 0) normalizedOffset += totalCycleDistance;

    const conceptIndex = Math.floor(normalizedOffset / conceptTotalDistance);
    const localOffset = normalizedOffset % conceptTotalDistance;
    const localCardIndex = Math.min(
      cardsPerConcept - 1,
      Math.floor(localOffset / Math.abs(zSpacing))
    );
    const isTransitioning = localOffset > cardSetDistance * 0.7;

    return { conceptIndex, localCardIndex, normalizedOffset, localOffset, isTransitioning };
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = container.querySelectorAll('.card');
    const { normalizedOffset } = getCurrentPosition();
    const totalCycleDistance = totalConcepts * conceptTotalDistance;

    cards.forEach((card, index) => {
      const cardConceptIndex = Math.floor(index / cardsPerConcept);
      const cardIndexWithinConcept = index % cardsPerConcept;

      let baseZ = cardConceptIndex * conceptTotalDistance + cardIndexWithinConcept * zSpacing;
      let zPosition = baseZ - normalizedOffset;

      if (zPosition < -totalCycleDistance / 2) {
        zPosition += totalCycleDistance;
      } else if (zPosition > totalCycleDistance / 2) {
        zPosition -= totalCycleDistance;
      }

      const distanceFromCenter = Math.abs(zPosition);
      const maxVisibleDistance = Math.abs(zSpacing) * 2.5;
      let opacity = Math.max(0, 1 - distanceFromCenter / maxVisibleDistance);
      opacity = Math.min(1, opacity);

      const scaleFactor = Math.abs(zSpacing) * 2;
      const scaleX = Math.max(1, 1 + (1 - distanceFromCenter / scaleFactor) * 0.3);
      const scaleY = Math.max(1, 1 + (1 - distanceFromCenter / scaleFactor) * 0.1);
      const horizontalOffset = (cardIndexWithinConcept % 2 === 0 ? -100 : 100) + '%';

      card.style.transform = `translateX(${horizontalOffset}) translateZ(${zPosition}px) scale(${scaleX}, ${scaleY})`;
      card.style.opacity = opacity;
      card.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-out';
      card.style.visibility = opacity > 0 ? 'visible' : 'hidden';
    });
  }, [scrollOffset]);

  const getCurrentTitleData = () => {
    const { conceptIndex, localOffset } = getCurrentPosition();
    const nextConceptIndex = (conceptIndex + 1) % totalConcepts;
    const switchPoint = cardSetDistance + Math.abs(zSpacing) * -0.5;

    let displayedTitle = concepts[conceptIndex].title;

    if (localOffset > switchPoint) {
      displayedTitle = concepts[nextConceptIndex].title;
    }

    return {
      displayedTitle,
      opacity: 1,
      transition: 'opacity 0.2s ease-in-out',
    };
  };

  const { displayedTitle, opacity, transition } = getCurrentTitleData();

  return (
    <div className="app" ref={containerRef}>
      <h1
        className="concept-title"
        style={{
          opacity: opacity,
          transition: transition,
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        {displayedTitle}
      </h1>
      <div className="card-container">
        {concepts.map((concept, conceptIndex) => (
          concept.cards.map((text, cardIndex) => (
            <div
              key={`${conceptIndex}-${cardIndex}`}
              className={`card card-${conceptIndex}-${cardIndex + 1}`}
            >
              {text}
            </div>
          ))
        ))}
      </div>
    </div>
  );
};

export default App;