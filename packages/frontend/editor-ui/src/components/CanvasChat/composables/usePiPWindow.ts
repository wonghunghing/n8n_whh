import { computed, type ComputedRef, onBeforeUnmount, onMounted, ref, type ShallowRef } from 'vue';

export function usePiPWindow(
	container: Readonly<ShallowRef<HTMLDivElement | null>>,
	content: Readonly<ShallowRef<HTMLDivElement | null>>,
): {
	isPoppedOut: ComputedRef<boolean>;
	canPopOut: ComputedRef<boolean>;
	onPopOut?: () => void;
} {
	const pipWindow = ref<Window>();
	const canPopOut = computed(() => !!window.documentPictureInPicture);
	const isPoppedOut = computed(() => !!pipWindow.value);

	function showPip() {
		if (!content.value) {
			return;
		}

		// Copy style sheets over from the initial document
		// so that the content looks the same.
		[...document.styleSheets].forEach((styleSheet) => {
			try {
				const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
				const style = document.createElement('style');

				style.textContent = cssRules;
				pipWindow.value?.document.head.appendChild(style);
			} catch (e) {
				const link = document.createElement('link');

				link.rel = 'stylesheet';
				link.type = styleSheet.type;
				pipWindow.value?.document.head.appendChild(link);
			}
		});

		// Move the content to the Picture-in-Picture window.
		pipWindow.value?.document.body.append(content.value);
		pipWindow.value?.addEventListener('pagehide', () => {
			pipWindow.value = undefined;

			if (content.value) {
				container.value?.appendChild(content.value);
			}
		});
	}

	async function onPopOut() {
		pipWindow.value = await window.documentPictureInPicture?.requestWindow();
		showPip();
	}

	onMounted(() => {
		// If PiP window is already open, render in PiP
		if (window.documentPictureInPicture?.window) {
			pipWindow.value = window.documentPictureInPicture.window;
			showPip();
		}
	});

	onBeforeUnmount(() => {
		if (content.value) {
			// Make the PiP window blank but keep it open
			pipWindow.value?.document.body.removeChild(content.value);
		}
	});

	return { canPopOut, isPoppedOut, onPopOut };
}
