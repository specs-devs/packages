import PanelPlugin from "LensStudio:PanelPlugin";
import * as Ui from "LensStudio:Ui";
import { WelcomeWidget, SPECS_ONLY_MESSAGE } from "./WelcomeWidget.ts";
import { SupabaseDataService } from "./SupabaseDataService.ts";
import { DashboardWidget } from "./DashboardWidget.ts";

// Main plugin class for Supabase Dashboard. It has 2 stacked widgets: welcomeWidget for login and dashboardWidget for main dashboard
export class SupabaseDashboard extends PanelPlugin {
  static descriptor() {
    return {
      id: 'Com.Snap.Supabase',
      name: 'Supabase',
      description: 'Supabase basic UI in Lens Studio',
      dependencies: [Ui.IGui],
    };
  }

  constructor(pluginSystem, descriptor) {
    super(pluginSystem, descriptor);
    this.mainWidget = null;
    this.stackedLayout = null;
    // login
    this.welcomeWidget = null;
    // main dashboard
    this.dashboardWidget = null;

    this.devConfig = {
      SUPABASE_AUTH_URL: "https://auth.supabase.io/auth/v1/token",
      SUPABASE_MANAGEMENT_API_URL: "https://cloudapi.snapcloud.co/",
      SUPABASE_DASHBOARD_URL: "https://cloud.snap.com/dashboard/",
      SUPABASE_PROJECT_DOMAIN: "snapcloud.dev",
      SUPABASE_DEFAULT_PROJECT_REGION: "us-east-1"
    }

    this.model = this.pluginSystem.findInterface(Editor.Model.IModel);
    this.authorization = this.pluginSystem.findInterface(Editor.IAuthorization);
    this.dataService = new SupabaseDataService(this.authorization, this.devConfig, this.model);
  }

  createWidget(parentWidget) {
    this.mainWidget = new Ui.Widget(parentWidget);
    this.stackedLayout = new Ui.StackedLayout();
    this.mainWidget.layout = this.stackedLayout;

    // Create welcome widget at index 0
    this.welcomeWidget = new WelcomeWidget(this.mainWidget, this.dataService);
    this.stackedLayout.addWidgetAt(this.welcomeWidget.getWidget(), 0);

    // Create initial dashboard widget at index 1
    this.createDashboardWidget();

    // Setup listeners for data service events
    this.setupDataServiceListeners();

    this.stackedLayout.currentIndex = 0;
    return this.mainWidget;
  }

  createDashboardWidget() {
    // Cleanup old dashboard widget if it exists
    // Because dashboardWidget has combo box which has no cleanup/remove method. So we recreate it.
    if (this.dashboardWidget) {
      this.dashboardWidget.cleanup();
      this.dashboardWidget = null;
    }

    // Create new dashboard widget and place it at index 1
    this.dashboardWidget = new DashboardWidget(this.mainWidget, this.model.project.assetManager, this.dataService);
    this.stackedLayout.addWidgetAt(this.dashboardWidget.getWidget(), 1);
  }

  setupDataServiceListeners() {
    // Listen to Snap authorization event to request Supabase authorization
    this.dataService.addEventListener('SnapAuthorization', (data) => {
      if (data && data.success) {
        this.dataService.requestSupabaseAuthorization();
      } else {
        // User logged out - clear everything and return to welcome screen
        this.dataService.clearAllData();

        // Recreate dashboard widget to make sure dashboard is cleaned up and refreshed when go back
        this.createDashboardWidget();

        // Return to welcome screen
        this.stackedLayout.currentIndex = 0;
        this.welcomeWidget.updateUI(false);
      }
    });
    // Listen to organizations fetched event to switch to dashboard
    this.dataService.addEventListener('organizationsFetched', (data) => {
      this.stackedLayout.currentIndex = 1;
    });
    // Snap Cloud is SPECS-only: enable/disable the dashboard on platform switch; session stays alive.
    // Off SPECS, also explain why the dashboard is inert (shown dimmed on the disabled widget).
    this.dataService.addEventListener('PlatformChanged', ({ isSpecs }) => {
      if (this.dashboardWidget) {
        this.dashboardWidget.getWidget().enabled = isSpecs;
        this.dataService.updateStatus(isSpecs ? "" : SPECS_ONLY_MESSAGE);
      }
    });
  }

  deinit() {
    this.dataService.cleanup();
  }
}
