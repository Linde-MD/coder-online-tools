import { createApp, nextTick } from 'vue';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';
import './styles/tailwind.css';
import './styles/common.css';
import './styles/style.css';
import App from './App.vue';
import { bootstrapApp } from './app/main.js';

document.body.classList.add('theme-warm-editorial');

const app = createApp(App);
app.mount('#app');

nextTick(() => {
	bootstrapApp();
});
