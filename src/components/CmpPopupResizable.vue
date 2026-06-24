<template>

    <!-- resizable=false: 純 passthrough, 不加任何尺寸/把手, 行為與未包裝時一致 -->
    <div v-if="!resizable">
        <slot></slot>
    </div>

    <!-- resizable=true: 固定寬高外框 + 八向把手(四邊四角) -->
    <div v-else :style="`position:relative; width:${useWidth}px; height:${useHeight}px; box-sizing:border-box;`">

        <div class="rpf-handle top" v-if="modes.includes('top')" @mousedown.prevent.stop="startResize('top', $event)"></div>
        <div class="rpf-handle bottom" v-if="modes.includes('bottom')" @mousedown.prevent.stop="startResize('bottom', $event)"></div>
        <div class="rpf-handle left" v-if="modes.includes('left')" @mousedown.prevent.stop="startResize('left', $event)"></div>
        <div class="rpf-handle right" v-if="modes.includes('right')" @mousedown.prevent.stop="startResize('right', $event)"></div>
        <div class="rpf-handle top-left" v-if="modes.includes('top-left')" @mousedown.prevent.stop="startResize('top-left', $event)"></div>
        <div class="rpf-handle top-right" v-if="modes.includes('top-right')" @mousedown.prevent.stop="startResize('top-right', $event)"></div>
        <div class="rpf-handle bottom-left" v-if="modes.includes('bottom-left')" @mousedown.prevent.stop="startResize('bottom-left', $event)"></div>
        <div class="rpf-handle bottom-right" v-if="modes.includes('bottom-right')" @mousedown.prevent.stop="startResize('bottom-right', $event)"></div>

        <slot></slot>

    </div>

</template>

<script>
/**
 * CmpPopupResizable
 * 套件內建的「可調整大小 popup 外框」。包在 WMaplibreglVue 的 popup slot 內層,
 * 由本元件自有尺寸 state(w/h), 以 inline style 寫在自身 root 上。
 * 拖曳期間 emit('resizing-change', true), 供外層在拖曳中暫停 recheckPopupDirections,
 * 避免地圖 move 觸發翻轉摧毀正在拖曳的 handler。
 */
export default {
    props: {
        resizable: { type: Boolean, default: false },
        resizeModes: { type: Array, default: () => ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] },
        minWidth: { type: Number, default: 200 },
        minHeight: { type: Number, default: 200 },
        width: { type: Number, default: 400 },
        height: { type: Number, default: 300 },
    },
    data() {
        return {
            //尺寸 state(本元件自有), 未拖曳前為 null → 用 props 初始值
            w: null,
            h: null,
            startStats: null,
            dragAction: null,
        }
    },
    computed: {
        modes: function() {
            return this.resizeModes || []
        },
        useWidth: function() {
            return this.w || this.width
        },
        useHeight: function() {
            return this.h || this.height
        },
    },
    methods: {

        startResize: function(dir, e) {
            let vo = this
            vo.dragAction = dir
            vo.startStats = { x: e.clientX, y: e.clientY, w: vo.useWidth, h: vo.useHeight }
            //依 popup 錨定方向決定縮放增益: 被 maplibre 置中(translate -50%)的軸, 其邊距中心為 size/2,
            //故拖該軸需 *2 才能讓被拖的邊跟上滑鼠(操作同步感). top/bottom→水平置中; left/right→垂直置中; 角錨定→皆 *1
            let anchor = ''
            let pe = (vo.$el && vo.$el.closest) ? vo.$el.closest('.maplibregl-popup') : null
            let mm = (pe && pe.className) ? String(pe.className).match(/maplibregl-popup-anchor-([a-z-]+)/) : null
            if (mm) {
                anchor = mm[1]
            }
            vo._gainX = (anchor === 'top' || anchor === 'bottom') ? 2 : 1
            vo._gainY = (anchor === 'left' || anchor === 'right') ? 2 : 1
            //pending 尺寸(拖曳中直接寫 DOM 用, 非響應式)
            vo._pendW = vo.useWidth
            vo._pendH = vo.useHeight
            //notify: 拖曳開始(外層用以暫停翻轉)
            vo.$emit('resizing-change', true)
            window.addEventListener('mousemove', vo.onResize)
            window.addEventListener('mouseup', vo.stopResize)
        },

        onResize: function(e) {
            let vo = this
            if (!vo.startStats) {
                return
            }
            let dx = e.clientX - vo.startStats.x
            let dy = e.clientY - vo.startStats.y
            //八向: 邊與角共用同一套 includes 判斷
            let nw = vo.startStats.w
            let nh = vo.startStats.h
            let d = vo.dragAction
            let gx = vo._gainX || 1
            let gy = vo._gainY || 1
            if (d.includes('right')) {
                nw += dx * gx
            }
            if (d.includes('left')) {
                nw += dx * -1 * gx
            }
            if (d.includes('bottom')) {
                nh += dy * gy
            }
            if (d.includes('top')) {
                nh += dy * -1 * gy
            }
            nw = Math.max(nw, vo.minWidth)
            nh = Math.max(nh, vo.minHeight)
            //拖曳中「不」改響應式 w/h(否則每次 mousemove 都重繪 frame 並連帶調和 slot → lag).
            //改暫存 pending 尺寸 + 用 rAF 直接寫 DOM, 上限 60fps.
            if (d.includes('left') || d.includes('right')) {
                vo._pendW = nw
            }
            if (d.includes('top') || d.includes('bottom')) {
                vo._pendH = nh
            }
            if (!vo._raf) {
                vo._raf = window.requestAnimationFrame(() => {
                    vo._raf = null
                    let el = vo.$el
                    if (el && el.style) {
                        el.style.width = vo._pendW + 'px'
                        el.style.height = vo._pendH + 'px'
                    }
                })
            }
        },

        stopResize: function() {
            let vo = this
            if (vo._raf) {
                window.cancelAnimationFrame(vo._raf)
                vo._raf = null
            }
            //拖曳結束才提交到響應式 state(尺寸持久, 與拖曳中直接寫入的 DOM 尺寸一致)
            vo.w = vo._pendW
            vo.h = vo._pendH
            if (vo.w || vo.h) {
                vo.$emit('resize', { width: vo.useWidth, height: vo.useHeight })
            }
            vo.startStats = null
            vo.dragAction = null
            vo.$emit('resizing-change', false)
            window.removeEventListener('mousemove', vo.onResize)
            window.removeEventListener('mouseup', vo.stopResize)
        },

    },
    beforeDestroy: function() {
        let vo = this
        if (vo._raf) {
            window.cancelAnimationFrame(vo._raf)
            vo._raf = null
        }
        window.removeEventListener('mousemove', vo.onResize)
        window.removeEventListener('mouseup', vo.stopResize)
    },
}
</script>

<style scoped>
.rpf-handle {
    position: absolute;
    background: rgba(255, 255, 255, 0.8);
    z-index: 1000;
    transition: opacity 0.2s;
    opacity: 0;
}
.rpf-handle:hover,
.rpf-handle:active { opacity: 1; }
.rpf-handle.top { top: 0; left: 0; width: 100%; height: 12px; cursor: ns-resize; transform: translateY(-6px); }
.rpf-handle.bottom { bottom: 0; left: 0; width: 100%; height: 12px; cursor: ns-resize; transform: translateY(6px); }
.rpf-handle.left { top: 0; left: 0; height: 100%; width: 12px; cursor: ew-resize; transform: translateX(-6px); }
.rpf-handle.right { top: 0; right: 0; height: 100%; width: 12px; cursor: ew-resize; transform: translateX(6px); }
.rpf-handle.top-left { top: 0; left: 0; width: 14px; height: 14px; cursor: nwse-resize; transform: translate(-6px, -6px); z-index: 1001; }
.rpf-handle.top-right { top: 0; right: 0; width: 14px; height: 14px; cursor: nesw-resize; transform: translate(6px, -6px); z-index: 1001; }
.rpf-handle.bottom-left { bottom: 0; left: 0; width: 14px; height: 14px; cursor: nesw-resize; transform: translate(-6px, 6px); z-index: 1001; }
.rpf-handle.bottom-right { bottom: 0; right: 0; width: 14px; height: 14px; cursor: nwse-resize; transform: translate(6px, 6px); z-index: 1001; }
</style>
