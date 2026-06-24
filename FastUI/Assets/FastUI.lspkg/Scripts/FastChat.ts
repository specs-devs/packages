/**
 * FastChat – programmatic chat UI with tunable inspector params.
 * No prefabs or scene object refs; cards are RectangleButtons with custom visuals.
 * Tune layout and colors in the inspector.
 */
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import { Slider } from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider";
import {
  buildRoundedRectangleOnto,
  getRoundedRectangleSizeFromText,
  FastRoundedRectangleOptions,
  FastRoundedRectangleStyle,
} from "./FastRoundedRectangle";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { bindStartEvent, bindUpdateEvent } from "SnapDecorators.lspkg/decorators";
import { CHARACTER_LIMITS } from "./Utils/TextLimiter";

const CardType = { User: "User" as const, Chatbot: "Chatbot" as const };
type CardType = (typeof CardType)[keyof typeof CardType];

interface CardData {
  id: number;
  type: CardType;
  textContent: string;
  size: vec3;
  sceneObject: SceneObject | null;
}

interface VisibleCardConfig {
  card: SceneObject | null;
  position: vec3;
  positionIndex: number;
  cardIndex: number;
}

class SwipeState {
  swipedObject: SceneObject | null = null;
  originalPosition: vec3 = vec3.zero();
  originalRotation: quat = quat.quatIdentity();
  isSwipping: boolean = false;
  swipeStartTime: number = 0;
  swipeStartPosition: vec3 = vec3.zero();
}

/** Color presets: user + bot colors for Style 1 Blue/Gray and Style 1 Green/Gray */
const STYLE_BLUE_GRAY = {
  userDefault: new vec4(0.2, 0.5, 0.9, 1),
  userHover: new vec4(0.3, 0.55, 0.95, 1),
  userTriggered: new vec4(0.1, 0.35, 0.75, 1),
  userBorder: new vec4(0.1, 0.35, 0.75, 1),
  botDefault: new vec4(0.25, 0.25, 0.28, 1),
  botHover: new vec4(0.35, 0.35, 0.38, 1),
  botTriggered: new vec4(0.2, 0.2, 0.22, 1),
  botBorder: new vec4(0.2, 0.2, 0.2, 1),
};
const STYLE_GREEN_GRAY = {
  userDefault: new vec4(0.2, 0.65, 0.35, 1),
  userHover: new vec4(0.3, 0.7, 0.4, 1),
  userTriggered: new vec4(0.1, 0.5, 0.25, 1),
  userBorder: new vec4(0.1, 0.5, 0.25, 1),
  botDefault: new vec4(0.25, 0.25, 0.28, 1),
  botHover: new vec4(0.35, 0.35, 0.38, 1),
  botTriggered: new vec4(0.2, 0.2, 0.22, 1),
  botBorder: new vec4(0.2, 0.2, 0.2, 1),
};

@component
export class FastChat extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">FastChat – placeholder chat component</span><br/><span style="color: #94A3B8; font-size: 11px;">No prefabs. Build your own logic and use the public API: addUserMessage(string), addBotMessage(string), getCardCount(), getCard(index) → SceneObject, getCardMessage(index) → string. Only the options below are shown.</span>')
  @ui.separator

  // ========== VISIBLE IN INSPECTOR (defaults set) ==========
  @input("string")
  @hint("Text color for all cards")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("White", "white"),
      new ComboBoxItem("Black", "black"),
      new ComboBoxItem("Gray", "gray"),
    ])
  )
  textColor: string = "white";

  @input("string")
  @hint("Style 1: one color for user, gray for bot")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Blue / Gray", "blue_gray"),
      new ComboBoxItem("Green / Gray", "green_gray"),
    ])
  )
  colorStyle: string = "blue_gray";

  @input("string")
  @hint("Layout: Aligned (centered) or Shifted (user right, bot left)")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Aligned", "aligned"),
      new ComboBoxItem("Shifted", "shifted"),
    ])
  )
  layoutStyle: string = "aligned";

  @input
  @hint("Fill chat with mock-up data (multiple sample cards)")
  testMode: boolean = true;

  @input
  @hint("Clip chat content to a window (MaskingComponent only, no scroll interaction)")
  mask: boolean = true;

  private scrollbarOffsetX: number = 13;
  private scrollbarHeight: number = 30;
  /** Mask clip (no interaction). Bounds from ScreenTransform on same object. */
  private maskingComponent: MaskingComponent | null = null;
  private maskWindowSize: vec2 = new vec2(30, 30);

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Logging Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Control logging output for this script instance</span>')

  @input
  @hint("Enable general logging (animation cycles, events, etc.)")
  enableLogging: boolean = false;

  @input
  @hint("Enable lifecycle logging (onAwake, onStart, onUpdate, onDestroy, etc.)")
  enableLoggingLifecycle: boolean = false;

  // ========== PRIVATE (not in inspector, fixed defaults) ==========
  private cardWidth: number = 22;
  private cardMinHeight: number = 4;
  private cardMaxHeight: number = 40;
  private cardMaxLines: number = 20;
  private slotSpacingY: number = 1;
  private layoutCenterY: number = 0;
  private spacingMultiplier: number = 1.0;
  private userCardOffsetX: number = 2;
  private botCardOffsetX: number = -2;
  private archDepth: number = 0.5;
  private showScrollbar: boolean = true;
  private cardBorderSize: number = 0.1;
  private animationSpeed: number = 0.5;
  private swipeThreshold: number = 50.0;
  private chatModeChronological: boolean = true;
  private initialNumberOfCards: number = 10;
  private testInterval: number = 2.0;
  private maxTestCards: number = 40;

  private cards: SceneObject[] = [];
  private cardData: CardData[] = [];
  private currentIndex: number = 0;
  private swipeState: SwipeState = new SwipeState();
  private basePositions: vec3[] = [];
  private currentPositions: vec3[] = [];
  private animatingCards: Map<SceneObject, { target: vec3; isVisible: boolean }> = new Map();
  private initialized: boolean = false;
  private logger: Logger;
  private testTimer: number = 0;
  private scrollbarObject: SceneObject | null = null;
  private scrollbarSlider: Slider | null = null;
  private skipScrollbarSync: boolean = false;

  onAwake(): void {
    this.logger = new Logger("FastChat", this.enableLogging || this.enableLoggingLifecycle, true);
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onAwake() - Component initializing");
    }
  }

  @bindStartEvent
  onStart(): void {
    if (this.enableLoggingLifecycle) {
      this.logger.debug("LIFECYCLE: onStart() - Initializing chat");
    }
    this.initialize();
  }

  @bindUpdateEvent
  onUpdate(): void {
    this.update();
  }

  private initialize(): void {
    if (this.initialized) return;
    this.setupBasePositions();
    this.createInitialCards();
    this.currentIndex = this.testMode ? Math.min(2, this.cardData.length - 1) : 0;
    this.recalculateDynamicPositions();
    this.layoutInitialCards();
    this.setupSwipeInteraction();
    if (this.showScrollbar) this.createScrollbar();
    if (this.mask) this.attachMasking();
    this.initialized = true;
    this.syncScrollbarFromIndex();
    if (this.enableLogging) {
      this.logger.debug("FastChat initialized with " + this.cardData.length + " cards");
    }
  }

  /** Add MaskingComponent + ScreenTransform for clip only (no scroll interaction). */
  private attachMasking(): void {
    const so = this.sceneObject;
    let st = so.getComponent("Component.ScreenTransform") as ScreenTransform | null;
    if (!st) {
      st = so.createComponent("Component.ScreenTransform") as ScreenTransform;
    }
    if (st) {
      const halfX = this.maskWindowSize.x * 0.5;
      const halfY = this.maskWindowSize.y * 0.5;
      st.anchors.left = 0;
      st.anchors.right = 0;
      st.anchors.bottom = 0;
      st.anchors.top = 0;
      st.offsets.left = -halfX;
      st.offsets.right = halfX;
      st.offsets.bottom = -halfY;
      st.offsets.top = halfY;
    }
    this.maskingComponent =
      (so.getComponent("Component.MaskingComponent") as MaskingComponent | null) ||
      (so.createComponent("Component.MaskingComponent") as MaskingComponent);
  }

  private getNormalizedScrollValue(): number {
    const n = this.cardData.length;
    if (n <= 1) return 0;
    return this.currentIndex / (n - 1);
  }

  private createScrollbar(): void {
    const name = "ChatScrollbar";
    this.scrollbarObject = global.scene.createSceneObject(name);
    this.scrollbarObject.setParent(this.sceneObject);
    this.scrollbarObject.getTransform().setLocalPosition(new vec3(this.scrollbarOffsetX, 0, 0.1));
    const zRotDeg = -90;
    this.scrollbarObject.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, (zRotDeg * Math.PI) / 180));
    const sliderComp = this.scrollbarObject.createComponent(Slider.getTypeName()) as Slider;
    if (sliderComp) {
      sliderComp.size = new vec3(this.scrollbarHeight, 1, 0.5);
      sliderComp.initialize();
      this.scrollbarSlider = sliderComp;
      sliderComp.currentValue = 0;
      if (sliderComp.onValueChange) {
        sliderComp.onValueChange.add((value: number) => {
          if (this.skipScrollbarSync) return;
          this.setScrollValue(value);
        });
      }
    }
  }

  private syncScrollbarFromIndex(): void {
    if (this.scrollbarObject) {
      this.scrollbarObject.enabled = this.cardData.length > 1;
    }
    if (!this.scrollbarSlider) return;
    this.skipScrollbarSync = true;
    this.scrollbarSlider.currentValue = this.getNormalizedScrollValue();
    this.skipScrollbarSync = false;
  }

  public setScrollValue(normalized: number): void {
    const n = this.cardData.length;
    if (n <= 1) return;
    const clamped = Math.max(0, Math.min(1, normalized));
    const idx = Math.round(clamped * (n - 1));
    if (idx !== this.currentIndex) {
      this.updateCardLayoutToIndex(idx);
    }
  }

  private setupBasePositions(): void {
    this.basePositions = [];
    for (let i = 0; i < 5; i++) {
      const y = this.layoutCenterY + (2 - i) * this.slotSpacingY;
      this.basePositions.push(new vec3(0, y, 0));
    }
  }

  private getCardPosition(slotPosition: vec3, cardIndex: number, positionIndex: number): vec3 {
    let x = slotPosition.x;
    let z = slotPosition.z;
    if (this.layoutStyle === "shifted" && cardIndex >= 0 && cardIndex < this.cardData.length) {
      const isUser = this.cardData[cardIndex].type === CardType.User;
      x += isUser ? this.userCardOffsetX : this.botCardOffsetX;
    }
    if (this.archDepth !== 0 && positionIndex >= 0 && positionIndex <= 4) {
      z += this.archDepth * (2 - Math.abs(positionIndex - 2));
    }
    return new vec3(x, slotPosition.y, z);
  }

  private calculateCardSize(text: string): vec3 {
    return getRoundedRectangleSizeFromText(
      text,
      this.cardWidth,
      this.cardMinHeight,
      this.cardMaxHeight,
      this.cardMaxLines
    );
  }

  /**
   * Compute slot Y positions from the center outward using each card's actual height,
   * so spacing between cards is consistent and cards don't overlap.
   * Mid slot (index 2) is at layoutCenterY; others are stacked with gap between edges.
   */
  private calculateDynamicPositions(
    basePositions: vec3[],
    cardSizes: vec3[],
    spacingMultiplier: number
  ): vec3[] {
    const gap = this.slotSpacingY * spacingMultiplier;
    const centerY = this.layoutCenterY;
    const h = (i: number) => (cardSizes[i] && cardSizes[i].y > 0 ? cardSizes[i].y : this.cardMinHeight) * 0.5;
    const result: vec3[] = [];
    for (let i = 0; i < 5; i++) result.push(new vec3(basePositions[i].x, 0, basePositions[i].z));
    result[2].y = centerY;
    result[1].y = centerY + h(2) + gap + h(1);
    result[0].y = result[1].y + h(1) + gap + h(0);
    result[3].y = centerY - (h(2) + gap + h(3));
    result[4].y = result[3].y - (h(3) + gap + h(4));
    return result;
  }

  private calculateVisibleIndices(
    currentIndex: number,
    length: number
  ): { topLast: number; top: number; mid: number; bottom: number; bottomLast: number } {
    const wrap = (i: number) => ((i % length) + length) % length;
    return {
      topLast: length > 0 ? wrap(currentIndex + 2) : -1,
      top: length > 0 ? wrap(currentIndex + 1) : -1,
      mid: currentIndex,
      bottom: length > 0 ? wrap(currentIndex - 1) : -1,
      bottomLast: length > 0 ? wrap(currentIndex - 2) : -1,
    };
  }

  private createInitialCards(): void {
    const count = this.testMode ? this.initialNumberOfCards : 1;
    const welcomeText =
      "Welcome to your AI-powered learning companion! Ask me anything about the topics you're studying.";
    const text = this.testMode ? this.generateTestText(0) : welcomeText.substring(0, CHARACTER_LIMITS.BOT_CARD_TEXT);

    for (let i = 0; i < count; i++) {
      const cardType = this.testMode ? (i % 2 === 0 ? CardType.User : CardType.Chatbot) : CardType.Chatbot;
      const textContent = this.testMode ? this.generateTestText(i) : text;
      const cardData: CardData = {
        id: i,
        type: cardType,
        textContent: textContent,
        size: this.calculateCardSize(textContent),
        sceneObject: null,
      };
      const cardObj = this.createCardProgrammatically(cardData);
      cardData.sceneObject = cardObj;
      this.cards.push(cardObj);
      this.cardData.push(cardData);
    }
  }

  /** Test messages sized so stated line count matches wrap at 30 chars/line. */
  private generateTestText(index: number): string {
    const lines = [
      "Hi!",                                                                                    // 1 line
      "How are you today?",                                                                     // 1 line
      "This is a two-line message that should wrap nicely.",                                     // 2 lines (49 chars)
      "This is a three-line message for testing medium-length content and wrapping.",            // 3 lines (62 chars)
      "This is a four-line message to test the middle range of the sizing system and how the text wraps onto multiple lines.", // 4 lines (97 chars)
      "This is a five-line message that tests longer content blocks and demonstrates how the chat layout adapts when you have a lot of text in a single bubble.", // 5 lines (127 chars)
    ];
    return lines[index % lines.length];
  }

  private getCardOptions(cardData: CardData): FastRoundedRectangleOptions {
    const isUser = cardData.type === CardType.User;
    const preset = this.colorStyle === "green_gray" ? STYLE_GREEN_GRAY : STYLE_BLUE_GRAY;
    const textColorKey = (this.textColor === "white" || this.textColor === "black" || this.textColor === "gray" ? this.textColor : "white") as "white" | "black" | "gray";
    return {
      content: cardData.textContent,
      width: this.cardWidth,
      minHeight: this.cardMinHeight,
      maxHeight: this.cardMaxHeight,
      maxLines: this.cardMaxLines,
      style: isUser ? "user" : "bot",
      borderSize: this.cardBorderSize,
      textColor: textColorKey,
      colorDefault: isUser ? preset.userDefault : preset.botDefault,
      colorHover: isUser ? preset.userHover : preset.botHover,
      colorTriggered: isUser ? preset.userTriggered : preset.botTriggered,
      borderColor: isUser ? preset.userBorder : preset.botBorder,
    };
  }

  private createCardProgrammatically(cardData: CardData): SceneObject {
    const name = `Card_${cardData.id}_${cardData.type}`;
    const cardObj = global.scene.createSceneObject(name);
    cardObj.setParent(this.sceneObject);
    cardObj.enabled = false;

    buildRoundedRectangleOnto(cardObj, this.getCardOptions(cardData));

    const manipulation = cardObj.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation;
    if (manipulation) {
      manipulation.onManipulationStart.add(() => this.startSwipe(cardObj));
      manipulation.onManipulationEnd.add(() => this.endSwipe());
    }

    return cardObj;
  }

  private recalculateDynamicPositions(): void {
    let indices: { topLast: number; top: number; mid: number; bottom: number; bottomLast: number };
    if (this.chatModeChronological) {
      indices = {
        topLast: this.currentIndex + 2 < this.cardData.length ? this.currentIndex + 2 : -1,
        top: this.currentIndex + 1 < this.cardData.length ? this.currentIndex + 1 : -1,
        mid: this.currentIndex,
        bottom: this.currentIndex - 1 >= 0 ? this.currentIndex - 1 : -1,
        bottomLast: this.currentIndex - 2 >= 0 ? this.currentIndex - 2 : -1,
      };
    } else {
      indices = this.calculateVisibleIndices(this.currentIndex, this.cardData.length);
    }
    const visibleIndices = [indices.topLast, indices.top, indices.mid, indices.bottom, indices.bottomLast];
    const cardSizes = visibleIndices.map((i) =>
      i >= 0 && i < this.cardData.length ? this.cardData[i].size : new vec3(this.cardWidth, this.cardMinHeight, 0.5)
    );
    this.currentPositions = this.calculateDynamicPositions(
      this.basePositions,
      cardSizes,
      this.spacingMultiplier
    );
  }

  private layoutInitialCards(): void {
    this.cards.forEach((c) => (c.enabled = false));
    const indices = this.calculateVisibleIndices(this.currentIndex, this.cardData.length);
    const visibleIndices = [indices.topLast, indices.top, indices.mid, indices.bottom, indices.bottomLast];
    visibleIndices.forEach((cardIndex, posIndex) => {
      if (cardIndex >= 0 && cardIndex < this.cards.length) {
        const card = this.cards[cardIndex];
        card.enabled = true;
        card.getTransform().setLocalPosition(this.getCardPosition(this.currentPositions[posIndex], cardIndex, posIndex));
      }
    });
  }

  private setupSwipeInteraction(): void {
    // Swipe is already wired in createCardProgrammatically for each card
  }

  private startSwipe(card: SceneObject): void {
    this.swipeState.swipedObject = card;
    this.swipeState.originalPosition = card.getTransform().getLocalPosition();
    this.swipeState.originalRotation = card.getTransform().getLocalRotation();
    this.swipeState.isSwipping = true;
    this.swipeState.swipeStartPosition = card.getTransform().getLocalPosition();
  }

  private endSwipe(): void {
    if (!this.swipeState.isSwipping || !this.swipeState.swipedObject) return;
    this.returnCardToOriginalPosition();
    this.swipeState.isSwipping = false;
    this.swipeState.swipedObject = null;
  }

  private returnCardToOriginalPosition(): void {
    if (!this.swipeState.swipedObject) return;
    this.swipeState.swipedObject.getTransform().setLocalRotation(this.swipeState.originalRotation);
    this.animatingCards.set(this.swipeState.swipedObject, {
      target: this.swipeState.originalPosition,
      isVisible: true,
    });
  }

  private update(): void {
    this.updateAnimations();
    if (this.testMode && this.initialized) {
      this.testTimer += getDeltaTime();
      if (this.testTimer >= this.testInterval && this.cardData.length < this.maxTestCards) {
        this.addTestCard();
        this.testTimer = 0;
      }
    }
  }

  private addTestCard(): void {
    const newIndex = this.cardData.length;
    const cardType = newIndex % 2 === 0 ? CardType.User : CardType.Chatbot;
    const textContent = this.generateTestText(newIndex % 6);
    const cardData: CardData = {
      id: newIndex,
      type: cardType,
      textContent,
      size: this.calculateCardSize(textContent),
      sceneObject: null,
    };
    const cardObj = this.createCardProgrammatically(cardData);
    cardData.sceneObject = cardObj;
    this.cards.push(cardObj);
    this.cardData.push(cardData);
    this.recalculateDynamicPositions();
    this.updateCardLayoutToIndex(this.currentIndex);
  }

  private updateCardLayoutToIndex(targetIndex: number): void {
    this.currentIndex = targetIndex;
    this.recalculateDynamicPositions();
    this.cleanupCardAnimations();
    this.hideAllCards();
    let indices: { topLast: number; top: number; mid: number; bottom: number; bottomLast: number };
    if (this.chatModeChronological) {
      indices = {
        topLast: this.currentIndex + 2 < this.cardData.length ? this.currentIndex + 2 : -1,
        top: this.currentIndex + 1 < this.cardData.length ? this.currentIndex + 1 : -1,
        mid: this.currentIndex,
        bottom: this.currentIndex - 1 >= 0 ? this.currentIndex - 1 : -1,
        bottomLast: this.currentIndex - 2 >= 0 ? this.currentIndex - 2 : -1,
      };
    } else {
      indices = this.calculateVisibleIndices(this.currentIndex, this.cardData.length);
    }
    const visibleCards: VisibleCardConfig[] = [
      { card: indices.topLast >= 0 && indices.topLast < this.cards.length ? this.cards[indices.topLast] : null, position: this.currentPositions[0], positionIndex: 0, cardIndex: indices.topLast },
      { card: indices.top >= 0 && indices.top < this.cards.length ? this.cards[indices.top] : null, position: this.currentPositions[1], positionIndex: 1, cardIndex: indices.top },
      { card: indices.mid >= 0 && indices.mid < this.cards.length ? this.cards[indices.mid] : null, position: this.currentPositions[2], positionIndex: 2, cardIndex: indices.mid },
      { card: indices.bottom >= 0 && indices.bottom < this.cards.length ? this.cards[indices.bottom] : null, position: this.currentPositions[3], positionIndex: 3, cardIndex: indices.bottom },
      { card: indices.bottomLast >= 0 && indices.bottomLast < this.cards.length ? this.cards[indices.bottomLast] : null, position: this.currentPositions[4], positionIndex: 4, cardIndex: indices.bottomLast },
    ];
    visibleCards.forEach(({ card, position, positionIndex, cardIndex }) => {
      if (card) {
        card.enabled = true;
        this.animatingCards.set(card, { target: this.getCardPosition(position, cardIndex, positionIndex), isVisible: true });
      }
    });
    this.syncScrollbarFromIndex();
  }

  private cleanupCardAnimations(): void {
    this.animatingCards.clear();
  }

  private hideAllCards(): void {
    this.cards.forEach((c) => (c.enabled = false));
  }

  private updateAnimations(): void {
    const toRemove: SceneObject[] = [];
    this.animatingCards.forEach((anim, card) => {
      if (!card || !card.getTransform()) {
        toRemove.push(card);
        return;
      }
      const cur = card.getTransform().getLocalPosition();
      const dist = cur.distance(anim.target);
      if (dist < 0.1) {
        card.getTransform().setLocalPosition(anim.target);
        if (!anim.isVisible) card.enabled = false;
        toRemove.push(card);
      } else {
        card.getTransform().setLocalPosition(vec3.lerp(cur, anim.target, this.animationSpeed));
      }
    });
    toRemove.forEach((c) => this.animatingCards.delete(c));
  }

  // ========== PUBLIC API ==========
  public addUserMessage(text: string): void {
    const content = text.substring(0, CHARACTER_LIMITS.USER_CARD_TEXT);
    this.addCard(CardType.User, content);
  }

  public addBotMessage(text: string): void {
    const content = text.substring(0, CHARACTER_LIMITS.BOT_CARD_TEXT);
    this.addCard(CardType.Chatbot, content);
  }

  private addCard(type: CardType, textContent: string): void {
    const id = this.cardData.length;
    const cardData: CardData = { id, type, textContent, size: this.calculateCardSize(textContent), sceneObject: null };
    const cardObj = this.createCardProgrammatically(cardData);
    cardData.sceneObject = cardObj;
    this.cards.push(cardObj);
    this.cardData.push(cardData);
    this.recalculateDynamicPositions();
    this.updateCardLayoutToIndex(this.cardData.length - 1);
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCardCount(): number {
    return this.cardData.length;
  }

  /** Returns the scene object for the card at the given index, or null if out of range. */
  public getCard(index: number): SceneObject | null {
    if (index < 0 || index >= this.cards.length) return null;
    return this.cards[index];
  }

  /** Returns the text content of the card at the given index, or empty string if out of range. */
  public getCardMessage(index: number): string {
    if (index < 0 || index >= this.cardData.length) return "";
    return this.cardData[index].textContent;
  }
}
