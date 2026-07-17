// Empty module to replace the stats.min import that's missing in three
// This is used as a polyfill to avoid build errors
export default class Stats {
  begin() {}
  end() {}
  showPanel() {}
  dom = { classList: { add: () => {} } }
}