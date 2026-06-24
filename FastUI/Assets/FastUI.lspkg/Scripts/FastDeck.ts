/**
 * FastDeck – swipeable card stack (deck-style UI). No prefabs; cards built with FastRoundedRectangle.
 * Three slots: left, center, right. Swipe center card left = next, right = previous.
 */
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import { buildRoundedRectangleOnto, FastRoundedRectangleOptions } from "./FastRoundedRectangle";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";

class SwipeState {
  swipedObject: SceneObject | null = null;
  originalPosition: vec3 = vec3.zero();
  isSwipping: boolean = false;
  swipeStartTime: number = 0;
  swipeStartPosition: vec3 = vec3.zero();
}

@component
export class FastDeck extends BaseScriptComponent {
  @ui.label(
    '<span style="color: #60A5FA;">FastDeck – swipeable card stack</span><br/><span style="color: #94A3B8; font-size: 11px;">No prefabs. Use addCard(string), getCardCount(), getCurrentIndex(), getCard(index). Swipe center card left = next, right = previous.</span>'
  )
  @ui.separator

  @input("number", "50.0")
  @hint("Minimum swipe distance to trigger card change")
  swipeThreshold: number = 50.0;

  @input("number", "0.5")
  @hint("Animation speed for card transitions (0–1)")
  animationSpeed: number = 0.5;

  @input("number", "100.0")
  @hint("Minimum swipe speed to trigger quick swipe")
  swipeSpeedThreshold: number = 100.0;

  @input("number", "0")
  @hint("Rotation (degrees) for left card")
  leftCardRotationZ: number = 0;

  @input("number", "0")
  @hint("Rotation (degrees) for right card")
  rightCardRotationZ: number = 0;

  @input
  @hint("Fill deck with sample cards for testing")
  testMode: boolean = false;

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging</span>')
  @input
  @hint("Enable general logging")
  enableLogging: boolean = false;
  @input
  @hint("Enable lifecycle logging")
  enableLoggingLifecycle: boolean = false;

  private cardWidth: number = 22;
  private cardMinHeight: number = 30;
  private cardMaxHeight: number = 40;
  private cardMaxLines: number = 20;
  private leftPosX: number = -12;
  private centerPosX: number = 0;
  private rightPosX: number = 12;
  private centerZ: number = 0.2;
  private sideZ: number = -0.7;
  private offScreenDistance: number = 200;
  private frontScale: number = 1;
  private backScale: number = 0.8;

  private cards: SceneObject[] = [];
  private cardContent: string[] = [];
  private currentIndex: number = 0;
  private swipeState: SwipeState = new SwipeState();
  private animatingCards: Map<
    SceneObject,
    { target: vec3; targetScale: number; isVisible: boolean }
  > = new Map();
  private initialized: boolean = false;
  private logger: Logger;

  onAwake(): void {
    this.logger = new Logger("FastDeck", this.enableLogging || this.enableLoggingLifecycle, true);
  }

  @bindStartEvent
  onStart(): void {
    if (this.enableLoggingLifecycle) this.logger.debug("LIFECYCLE: onStart()");
    this.initialize();
  }

  @bindUpdateEvent
  onUpdate(): void {
    this.update();
  }

  private initialize(): void {
    if (this.initialized) return;
    if (this.testMode) {
      this.addCard(
        "First card – swipe me to go next. This is the left slot and uses the blue style. Add more content here so the card wraps to multiple lines."
      );
      this.addCard(
        "Second card is in the center when you start. It uses the gray style. Swipe left to see the next card or right to go back. You can put quite a bit of text on each card."
      );
      this.addCard(
        "Third card appears on the right with the green style. All three visible cards have different colors: blue on the left, gray in the center, green on the right."
      );
      this.addCard(
        "Fourth card. Keep swiping through the deck. Each card keeps its content but the color follows its slot: left is always blue, center gray, right green."
      );
      this.addCard(
        "Last card in the test deck. Enable test mode to see these five sample cards with longer text. Disable test mode and use addCard() from script to build your own deck."
      );
    }
    if (this.cards.length > 0) {
      this.layoutInitialCards();
    }
    this.setupCenterCardManipulation();
    this.initialized = true;
    if (this.enableLogging) this.logger.debug("FastDeck initialized with " + this.cards.length + " cards");
  }

  private getLocalPositions(): vec3[] {
    return [
      new vec3(this.leftPosX, 0, this.sideZ),
      new vec3(this.centerPosX, 0, this.centerZ),
      new vec3(this.rightPosX, 0, this.sideZ),
    ];
  }

  /** Add a card with the given content. Returns card index. */
  public addCard(content: string): number {
    const index = this.cards.length;
    const name = "DeckCard_" + index;
    const cardObj = global.scene.createSceneObject(name);
    cardObj.setParent(this.sceneObject);
    cardObj.enabled = false;

    const options = this.getCardOptions(content);
    buildRoundedRectangleOnto(cardObj, options);

    const manipulation = cardObj.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation;
    if (manipulation) {
      manipulation.onManipulationStart.add(() => this.startSwipe(cardObj));
      manipulation.onManipulationEnd.add(() => this.endSwipe());
    }

    this.cards.push(cardObj);
    this.cardContent.push(content || "");

    if (this.initialized && this.cards.length === 1) {
      this.layoutInitialCards();
      this.setupCenterCardManipulation();
    }
    return index;
  }

  public getCardCount(): number {
    return this.cards.length;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCard(index: number): SceneObject | null {
    if (index < 0 || index >= this.cards.length) return null;
    return this.cards[index];
  }

  public getCardContent(index: number): string {
    if (index < 0 || index >= this.cardContent.length) return "";
    return this.cardContent[index];
  }

  public getCurrentCard(): SceneObject | null {
    return this.getCard(this.currentIndex);
  }

  /** Manually trigger next card (swipe left). */
  public manualSwipeLeft(): void {
    if (this.cards.length === 0) return;
    const centerCard = this.getCurrentCard();
    if (centerCard && !this.swipeState.isSwipping) {
      this.swipeState.swipedObject = centerCard;
      this.swipeLeft();
      this.swipeState.swipedObject = null;
    }
  }

  /** Manually trigger previous card (swipe right). */
  public manualSwipeRight(): void {
    if (this.cards.length === 0) return;
    const centerCard = this.getCurrentCard();
    if (centerCard && !this.swipeState.isSwipping) {
      this.swipeState.swipedObject = centerCard;
      this.swipeRight();
      this.swipeState.swipedObject = null;
    }
  }

  /** Neutral rectangle button (no slot styling). */
  private getCardOptions(content: string): FastRoundedRectangleOptions {
    return {
      content,
      width: this.cardWidth,
      minHeight: this.cardMinHeight,
      maxHeight: this.cardMaxHeight,
      maxLines: this.cardMaxLines,
      style: "bot",
      textColor: "white",
    };
  }

  private getScaleForSlot(slotIndex: 0 | 1 | 2): number {
    return slotIndex === 1 ? this.frontScale : this.backScale;
  }

  private layoutInitialCards(): void {
    const positions = this.getLocalPositions();
    this.cards.forEach((c) => (c.enabled = false));

    const n = this.cards.length;
    if (n === 0) return;

    if (n === 1) {
      const card = this.cards[0];
      card.enabled = true;
      card.getTransform().setLocalPosition(positions[1]);
      card.getTransform().setLocalScale(new vec3(this.frontScale, this.frontScale, this.frontScale));
      this.applyCardRotation(card, 1);
      this.setCardManipulationEnabled(card, true);
      return;
    }

    if (n === 2) {
      const leftIndex = (this.currentIndex - 1 + n) % n;
      const centerIndex = this.currentIndex;
      this.cards[leftIndex].enabled = true;
      this.cards[leftIndex].getTransform().setLocalPosition(positions[0]);
      this.cards[leftIndex].getTransform().setLocalScale(new vec3(this.backScale, this.backScale, this.backScale));
      this.applyCardRotation(this.cards[leftIndex], 0);
      this.setCardManipulationEnabled(this.cards[leftIndex], false);
      this.cards[centerIndex].enabled = true;
      this.cards[centerIndex].getTransform().setLocalPosition(positions[1]);
      this.cards[centerIndex].getTransform().setLocalScale(new vec3(this.frontScale, this.frontScale, this.frontScale));
      this.applyCardRotation(this.cards[centerIndex], 1);
      this.setCardManipulationEnabled(this.cards[centerIndex], true);
      return;
    }

    const leftIndex = (this.currentIndex - 1 + n) % n;
    const centerIndex = this.currentIndex;
    const rightIndex = (this.currentIndex + 1) % n;
    const indices = [leftIndex, centerIndex, rightIndex];
    for (let i = 0; i < 3; i++) {
      const card = this.cards[indices[i]];
      const scale = this.getScaleForSlot(i as 0 | 1 | 2);
      card.enabled = true;
      card.getTransform().setLocalPosition(positions[i]);
      card.getTransform().setLocalScale(new vec3(scale, scale, scale));
      this.applyCardRotation(card, i as 0 | 1 | 2);
      this.setCardManipulationEnabled(card, i === 1);
    }
  }

  private setupCenterCardManipulation(): void {
    this.cards.forEach((card) => this.setCardManipulationEnabled(card, false));
    const centerCard = this.getCurrentCard();
    if (centerCard) this.setCardManipulationEnabled(centerCard, true);
  }

  private setCardManipulationEnabled(card: SceneObject, enabled: boolean): void {
    const manipulation = card.getComponent(InteractableManipulation.getTypeName()) as InteractableManipulation | null;
    if (manipulation) manipulation.enabled = enabled;
  }

  private applyCardRotation(card: SceneObject, position: 0 | 1 | 2): void {
    const transform = card.getTransform();
    let rotationZ = 0;
    if (position === 0) rotationZ = this.leftCardRotationZ;
    else if (position === 2) rotationZ = this.rightCardRotationZ;
    const euler = transform.getLocalRotation().toEulerAngles();
    transform.setLocalRotation(quat.fromEulerAngles(euler.x, euler.y, (rotationZ * Math.PI) / 180));
  }

  private startSwipe(card: SceneObject): void {
    this.swipeState.swipedObject = card;
    this.swipeState.originalPosition = card.getTransform().getLocalPosition();
    this.swipeState.isSwipping = true;
    this.swipeState.swipeStartTime = getTime();
    this.swipeState.swipeStartPosition = card.getTransform().getLocalPosition();
  }

  private endSwipe(): void {
    if (!this.swipeState.isSwipping || !this.swipeState.swipedObject) return;

    const currentPos = this.swipeState.swipedObject.getTransform().getLocalPosition();
    const swipeDistance = currentPos.distance(this.swipeState.originalPosition);
    const swipeTime = getTime() - this.swipeState.swipeStartTime;
    const swipeSpeed = swipeTime > 0 ? swipeDistance / swipeTime : 0;
    const swipeVector = currentPos.sub(this.swipeState.originalPosition);
    const isRightSwipe = swipeVector.x > 0;
    const shouldChange = swipeDistance > this.swipeThreshold || swipeSpeed > this.swipeSpeedThreshold;

    if (shouldChange) {
      if (isRightSwipe) this.swipeRight();
      else this.swipeLeft();
    } else {
      this.returnCardToCenter();
    }

    this.swipeState.isSwipping = false;
    this.swipeState.swipedObject = null;
  }

  private returnCardToCenter(): void {
    if (!this.swipeState.swipedObject) return;
    const positions = this.getLocalPositions();
    this.animatingCards.set(this.swipeState.swipedObject, {
      target: positions[1],
      targetScale: this.frontScale,
      isVisible: true,
    });
  }

  private swipeLeft(): void {
    if (!this.swipeState.swipedObject) return;
    this.animateCardOut(this.swipeState.swipedObject, false);
    const n = this.cards.length;
    if (n > 0) this.currentIndex = (this.currentIndex + 1) % n;
    this.rearrangeCardsAfterSwipe();
  }

  private swipeRight(): void {
    if (!this.swipeState.swipedObject) return;
    this.animateCardOut(this.swipeState.swipedObject, true);
    const n = this.cards.length;
    if (n > 0) this.currentIndex = (this.currentIndex - 1 + n) % n;
    this.rearrangeCardsAfterSwipe();
  }

  private animateCardOut(card: SceneObject, toRight: boolean): void {
    const positions = this.getLocalPositions();
    const centerPos = positions[1];
    const direction = toRight ? 1 : -1;
    const targetPos = new vec3(centerPos.x + this.offScreenDistance * direction, centerPos.y, centerPos.z);
    this.animatingCards.set(card, { target: targetPos, targetScale: this.frontScale, isVisible: false });
  }

  private rearrangeCardsAfterSwipe(): void {
    const positions = this.getLocalPositions();
    const n = this.cards.length;
    if (n === 0) return;

    this.cards.forEach((card) => {
      if (!this.animatingCards.has(card)) card.enabled = false;
      this.setCardManipulationEnabled(card, false);
    });

    if (n === 1) {
      const card = this.cards[0];
      card.enabled = true;
      this.animatingCards.set(card, {
        target: positions[1],
        targetScale: this.frontScale,
        isVisible: true,
      });
      this.applyCardRotation(card, 1);
      this.setCardManipulationEnabled(card, true);
      return;
    }

    if (n === 2) {
      const leftIndex = (this.currentIndex - 1 + n) % n;
      const centerIndex = this.currentIndex;
      this.cards[leftIndex].enabled = true;
      this.animatingCards.set(this.cards[leftIndex], {
        target: positions[0],
        targetScale: this.backScale,
        isVisible: true,
      });
      this.applyCardRotation(this.cards[leftIndex], 0);
      this.setCardManipulationEnabled(this.cards[leftIndex], false);
      this.cards[centerIndex].enabled = true;
      this.animatingCards.set(this.cards[centerIndex], {
        target: positions[1],
        targetScale: this.frontScale,
        isVisible: true,
      });
      this.applyCardRotation(this.cards[centerIndex], 1);
      this.setCardManipulationEnabled(this.cards[centerIndex], true);
      return;
    }

    const leftIndex = (this.currentIndex - 1 + n) % n;
    const centerIndex = this.currentIndex;
    const rightIndex = (this.currentIndex + 1) % n;
    const indices = [leftIndex, centerIndex, rightIndex];
    for (let i = 0; i < 3; i++) {
      const card = this.cards[indices[i]];
      card.enabled = true;
      this.animatingCards.set(card, {
        target: positions[i],
        targetScale: this.getScaleForSlot(i as 0 | 1 | 2),
        isVisible: true,
      });
      this.applyCardRotation(card, i as 0 | 1 | 2);
      this.setCardManipulationEnabled(card, i === 1);
    }
    this.setupCenterCardManipulation();
  }

  private update(): void {
    this.updateAnimations();
  }

  private updateAnimations(): void {
    const toRemove: SceneObject[] = [];
    this.animatingCards.forEach((anim, card) => {
      const transform = card.getTransform();
      const currentPos = transform.getLocalPosition();
      const targetPos = anim.target;
      const distance = currentPos.distance(targetPos);
      const currentScale = transform.getLocalScale().x;
      const scaleDistance = Math.abs(currentScale - anim.targetScale);
      const done = distance < 0.1 && scaleDistance < 0.01;
      if (done) {
        transform.setLocalPosition(targetPos);
        transform.setLocalScale(new vec3(anim.targetScale, anim.targetScale, anim.targetScale));
        if (!anim.isVisible) card.enabled = false;
        toRemove.push(card);
      } else {
        transform.setLocalPosition(vec3.lerp(currentPos, targetPos, this.animationSpeed));
        const newScale = currentScale + (anim.targetScale - currentScale) * this.animationSpeed;
        transform.setLocalScale(new vec3(newScale, newScale, newScale));
      }
    });
    toRemove.forEach((c) => this.animatingCards.delete(c));
  }
}
