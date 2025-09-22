Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html
  ID_PATTERN = /[^\/]+/ # all characters but '/'

  # login routes
  get "auth/:provider/callback", to: "sessions#create"
  get "auth/developer/login", to: "sessions#new"
  post "auth/developer/login", to: "sessions#developer" if Rails.env.local?
  get "/login", to: "sessions#new"
  get "/logout", to: "sessions#logout"

  # some maplibre styles (openfreemap liberty) try to load eg. ./swimming_pool
  # from local server instead of style host... catching those calls here
  # # List defined in initializers/filter_parameter_logging.rb
  get "/m/:resource", to: "maps#catchall", constraints:
    { resource: Regexp.union(Rails.application.config.x.catch_map_assets) }

  scope "/m" do
    get "", to: "maps#index", as: "maps"
    get "/", to: "maps#index"

    # map exports
    get "/:id.json" => "maps#show", as: :map_json, constraints: { id: ID_PATTERN }, defaults: { format: "json" }
    get "/:id.geojson" => "maps#show", as: :map_geojson, constraints: { id: ID_PATTERN }, defaults: { format: "geojson" }
    get "/:id.gpx" => "maps#show", as: :map_gpx, constraints: { id: ID_PATTERN }, defaults: { format: "gpx" }
    get "/:id/properties" => "maps#properties", as: :map_properties, constraints: { id: ID_PATTERN }
    get "/:id/feature/:feature_id(/:name)" => "maps#feature", as: :map_feature, constraints: { id: ID_PATTERN, feature_id: ID_PATTERN, name: ID_PATTERN }
    get "/:id(/:name)" => "maps#show", as: :map, format: :html, constraints: { id: ID_PATTERN, name: ID_PATTERN }

    post "" => "maps#create", as: :create_map
    delete "/:id" => "maps#destroy", as: :destroy_map, constraints: { id: ID_PATTERN }
  end
  post "/demo" => "maps#demo", as: "demo"
  get "/my" => "maps#my", as: "my"

  get "/d/:id" => "maps#show", defaults: { engine: "deck" }, as: :deck, constraints: { id: ID_PATTERN }

  get "/admin" => "admin#index"
  get "/tutorials" => "docs#tutorials", as: :tutorials
  get "/tutorial/:id" => "docs#tutorial", as: :tutorial

  # map icons
  get "/icon/osmc/:osmc_symbol", to: "images#osmc_symbol", as: "osmc"
  get "/icon/:public_id", to: "images#icon", as: "icon", constraints: { public_id: ID_PATTERN }
  get "/image/:public_id", to: "images#image", as: "image", constraints: { public_id: ID_PATTERN }
  post "/images", to: "images#upload", as: "upload"

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "health#show", as: :rails_health_check
  get "sitemap", to: "application#sitemap", defaults: { format: "xml" }

  # Defines the root path route ("/")
  root "frontpage#index", as: :frontpage
  get "/" => "frontpage#index", as: :root
  # legacy link, still used by search engines
  get "/home", to: redirect("/")

  mount Ulogger::Engine, at: "/ulogger"
end
