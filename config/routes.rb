Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html
  ID_PATTERN = /[^\/]+/ # all characters but '/'
  NAME_PATTERN = /[^\/]+/ # all characters but '/'

  # login routes
  get "auth/:provider/callback", to: "sessions#create"
  get "auth/developer/login", to: "sessions#new"
  post "auth/developer/login", to: "sessions#developer" if Rails.env.local?
  get "/login", to: "sessions#new"
  get "/logout", to: "sessions#logout"

  scope "/m" do
    get "", to: "maps#index", as: "maps"
    get "/", to: "maps#index"

    # map exports
    # ids can have dots, so define formats explicitly
    get "/:id.json(/:name)" => "maps#show", as: :map_json, constraints: { id: ID_PATTERN, name: NAME_PATTERN }, defaults: { format: "json" }
    get "/:id.geojson(/:name)" => "maps#show", as: :map_geojson, constraints: { id: ID_PATTERN, name: NAME_PATTERN }, defaults: { format: "geojson" }
    get "/:id.gpx(/:name)" => "maps#show", as: :map_gpx, constraints: { id: ID_PATTERN, name: NAME_PATTERN }, defaults: { format: "gpx" }
    get "/:id(/:name)" => "maps#show", as: :map, format: :html, constraints: { id: ID_PATTERN, name: NAME_PATTERN }
    get "/:id/properties" => "maps#properties", as: :map_properties, constraints: { id: ID_PATTERN }
    get "/:id/feature/:feature_id.geojson(/:name)" => "maps#feature", as: :map_feature_geo, constraints: { id: ID_PATTERN, feature_id: ID_PATTERN, name: NAME_PATTERN }, defaults: { format: "geojson" }
    get "/:id/feature/:feature_id.gpx(/:name)" => "maps#feature", as: :map_feature_gpx, constraints: { id: ID_PATTERN, feature_id: ID_PATTERN, name: NAME_PATTERN }, defaults: { format: "gpx" }

    post "" => "maps#create", as: :create_map
    post "/:id/copy" => "maps#copy", as: :copy_map, constraints: { id: ID_PATTERN }
    delete "/:id" => "maps#destroy", as: :destroy_map, constraints: { id: ID_PATTERN }
  end

  post "/tutorial" => "maps#tutorial", as: "tutorial"
  get "/my" => "maps#my", as: "my"

  get "/d/:id" => "maps#show", defaults: { engine: "deck" }, as: :deck, constraints: { id: ID_PATTERN }

  get "/admin" => "admin#index"
  get "/docs" => "docs#tutorials", as: :docs
  get "/tutorial/:id" => "docs#tutorial" # legacy route
  get "/doc/:id" => "docs#tutorial", as: :doc

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
