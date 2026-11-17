import 'UIKit.lspkg/Scripts/Themes/ThemeService'
import {BackPlate} from 'UIKit.lspkg/Scripts/BackPlate'
import {RectangleButton} from 'UIKit.lspkg/Scripts/Components/Button/RectangleButton'
import {ElementContent, TextAlignment} from 'UIKit.lspkg/Scripts/Components/Content/ElementContent'
import {Switch} from 'UIKit.lspkg/Scripts/Components/Switch/Switch'
import {TextInputField} from 'UIKit.lspkg/Scripts/Components/TextInputField/TextInputField'
import {FlexLayout} from 'UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout'
import {FlexItem} from 'UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem'
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from 'UIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes'
import {ProviderId, PROVIDERS, SocialConfig} from './SocialConfig'

const ICONS: Record<ProviderId, Texture> = {
  snapchat: requireAsset('../Icons/snapchat.png') as Texture,
  x: requireAsset('../Icons/x.png') as Texture,
  youtube: requireAsset('../Icons/youtube.png') as Texture,
  linkedin: requireAsset('../Icons/linkedin.png') as Texture,
  instagram: requireAsset('../Icons/instagram.png') as Texture,
  threads: requireAsset('../Icons/threads.png') as Texture,
  tiktok: requireAsset('../Icons/tiktok.png') as Texture
}
const TYPE_SCALE = {title: {size: 62, weight: 700}, body: {size: 39, weight: 500}, caption: {size: 38, weight: 500}}
interface Actions {record: () => void; photo: () => void; share: () => void; refresh: () => void; select: (id: ProviderId) => void; privacy: (id: ProviderId) => void}
export class SocialPanel {
  private status: Text
  private captionLabel: Text
  private caption: TextInputField
  private selected: ProviderId = 'instagram'
  private content: Record<string, ElementContent> = {}
  private privacyContent: ElementContent
  private formatContent: ElementContent
  private recordContent: ElementContent
  private shareContent: ElementContent
  private connections: Record<string, boolean> = {}
  constructor(root: SceneObject, private config: SocialConfig, private actions: Actions, private width: number = 44, private fontScale: number = 1) {
    root.createComponent('Component.Canvas')
    const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
    const outer = this.obj(root, 'Social Content', 0.6)
    const layout = outer.createComponent(FlexLayout.getTypeName()) as FlexLayout
    layout.onInitialized.add(() => {
      layout.width = width; layout.height = -1; layout.direction = FlexDirection.Column
      layout.alignItems = FlexAlign.Stretch; layout.rowGap = 0.3
      layout.paddingTop = 1.6; layout.paddingBottom = 1.6; layout.paddingLeft = 1.6; layout.paddingRight = 1.6
      this.child(outer, width - 3.2, 2.5, item => this.text(item, 'Snap Cloud Social Media', 'title'))
      this.child(outer, width - 3.2, 2, item => this.text(item, config.demoMode ? 'DEMO · No posts leave this Lens' : 'Record once. Choose your destinations.', 'caption'))
      for (const p of PROVIDERS) {
        this.child(outer, width - 3.2, 4.4, row => {
          const flex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
          flex.onInitialized.add(() => {
            flex.width = width - 3.2; flex.height = 4.4; flex.direction = FlexDirection.Row; flex.columnGap = 0.8; flex.alignItems = FlexAlign.Center
            this.child(row, width - 9.4, 4.4, cell => {
              this.content[p.id] = this.button(cell, p.name + ' · Setup needed', width - 9.4, () => this.select(p.id), ICONS[p.id])
            })
            this.child(row, 5.4, 3.2, cell => {
              const toggle = cell.createComponent(Switch.getTypeName()) as Switch
              toggle.size = new vec3(5.4, 4.4, 1); toggle.initialize(); toggle.isOn = config.destinations[p.id].enabled
              toggle.onFinished.add(() => {config.destinations[p.id].enabled = toggle.isOn; this.updateShareLabel()})
            })
          })
        })
      }
      this.child(outer, width - 3.2, 2, item => {this.captionLabel = this.text(item, 'Instagram caption', 'caption')})
      this.child(outer, width - 3.2, 4.5, item => {
        this.caption = item.createComponent(TextInputField.getTypeName()) as TextInputField
        this.caption.size = new vec3(width - 3.2, 4.5, 1)
        this.caption.onTextChanged.add(text => {config.destinations[this.selected].caption = text})
      })
      this.child(outer, width - 3.2, 4.4, item => {
        this.formatContent = this.button(item, 'Format: Reel', width - 3.2, () => this.cycleFormat())
      })
      this.child(outer, width - 3.2, 4.4, item => {
        this.privacyContent = this.button(item, 'Delivery settings', width - 3.2, () => this.actions.privacy(this.selected))
      })
      this.child(outer, width - 3.2, 4.4, row => {
        const flex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
        flex.onInitialized.add(() => {
          flex.direction = FlexDirection.Row; flex.width = width - 3.2; flex.height = 4.4; flex.columnGap = 0.8
          this.child(row, (width - 4) / 2, 4.4, item => {this.recordContent = this.button(item, 'Record', (width - 4) / 2, actions.record)})
          this.child(row, (width - 4) / 2, 4.4, item => this.button(item, 'Photo', (width - 4) / 2, actions.photo))
        })
      })
      this.child(outer, width - 3.2, 4.4, item => {this.shareContent = this.button(item, 'Share', width - 3.2, actions.share)})
      this.child(outer, width - 3.2, 3.5, item => this.button(item, 'Refresh connections', width - 3.2, actions.refresh))
      this.child(outer, width - 3.2, 4, item => {this.status = this.text(item, 'Preparing social studio…', 'caption')})
      this.caption.onInitialized.add(() => this.select(this.selected))
    })
    layout.onLayoutComplete.add(result => {plate.size = new vec2(result.containerWidth, result.containerHeight)})
  }
  select(id: ProviderId): void {
    this.selected = id
    const p = PROVIDERS.find(p => p.id === id),d = this.config.destinations[id]
    if(this.captionLabel) this.captionLabel.text = p.name + ' caption'
    if(this.caption) this.caption.text = d.caption || this.config.composer.caption
    if(this.formatContent) this.formatContent.text = 'Format: ' + d.format
    this.deliveryLabel()
    this.actions.select(id)
  }
  deliveryLabel(): void {
    if(!this.privacyContent)return
    const d=this.config.destinations[this.selected]
    this.privacyContent.text = this.selected==='youtube'?'YouTube privacy: '+(d.privacy||'private')
      :this.selected==='tiktok'?(d.publishMode==='direct'?'TikTok privacy: '+(d.privacyLevel||'Choose before sharing'):'TikTok: inbox upload')
      :this.selected==='snapchat'?'Public Profile · Stories omit captions'
      :this.selected==='instagram'&&d.format==='story'?'Story caption is not added to video'
      :'Publish to connected '+this.selected+' account'
  }
  private cycleFormat(): void {
    const p = PROVIDERS.find(p => p.id === this.selected), d = this.config.destinations[this.selected]
    d.format = p.formats[(p.formats.indexOf(d.format) + 1) % p.formats.length]
    this.select(this.selected)
  }
  setConnection(id: ProviderId, connected: boolean): void {
    this.connections[id] = connected
    if(this.content[id]) this.content[id].text = PROVIDERS.find(p => p.id === id).name + ' · ' + (this.config.demoMode ? 'Demo' : connected ? 'Connected' : 'Setup needed')
    this.updateShareLabel()
  }
  private updateShareLabel(): void {
    const count = PROVIDERS.filter(p => this.config.destinations[p.id].enabled && this.connections[p.id]).length
    if(this.shareContent)this.shareContent.text = (this.config.demoMode ? 'Simulate share to ' : 'Share to ') + count
  }
  setStatus(text: string): void {if(this.status) this.status.text = text}
  setRecording(on: boolean): void {if(this.recordContent) this.recordContent.text = on ? 'Stop recording' : 'Record'}
  private obj(parent: SceneObject, name: string, z: number = 0.02): SceneObject {
    const child = global.scene.createSceneObject(name); child.setParent(parent); child.getTransform().setLocalPosition(new vec3(0, 0, z));return child
  }
  private child(parent: SceneObject, w: number, h: number, builder: (child: SceneObject) => void): SceneObject {
    const child = this.obj(parent, 'Item'),item = child.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w;item.overrideHeight = h;item.flexShrink = 0;item.alignSelf = FlexAlignSelf.Stretch
    builder(child)
    // Every caller runs inside the parent layout's onInitialized, so it is initialized. Register
    // directly: ReplayEvent doesn't replay to handlers added while it is being invoked.
    const layout = parent.getComponent(FlexLayout.getTypeName()) as FlexLayout
    layout.addItems([item])
    return child
  }
  private button(parent: SceneObject, title: string, width: number, action: () => void, icon?: Texture): ElementContent {
    const button = parent.createComponent(RectangleButton.getTypeName()) as RectangleButton
    button.size = new vec3(width, 4.4, 1)
    button.onTriggerUp.add(action)
    const host = this.obj(parent, 'Button Content', 0.08)
    const content = host.createComponent(ElementContent.getTypeName()) as ElementContent
    content.text = title;content.textSize = TYPE_SCALE.body.size * this.fontScale;content.sizeOverride = new vec2(width - 1.4, 4.4);content.textAlignment = icon ? TextAlignment.Left : TextAlignment.Center
    if(icon) {content.leadingIcon = icon;content.leadingIconSize = 2.6;content.spacing = 0.8}
    return content
  }
  private text(parent: SceneObject, value: string, role: keyof typeof TYPE_SCALE): Text {
    const text = parent.createComponent('Component.Text') as Text
    text.text = value;text.size = TYPE_SCALE[role].size * this.fontScale
    ;(text as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
    text.depthTest = true;text.horizontalAlignment = HorizontalAlignment.Left;text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Wrap;text.layoutRect = Rect.create(-this.width / 2 + 1.6, this.width / 2 - 1.6, -2, 2)
    return text
  }
}
