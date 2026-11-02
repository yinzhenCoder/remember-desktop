import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import EntryIntro from "./EntryIntro.vue";
import LandingHome from "./LandingHome.vue";
import "./site.css";

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "layout-top": () => h(EntryIntro),
    });
  },
  enhanceApp({ app }) {
    app.component("LandingHome", LandingHome);
  },
};
