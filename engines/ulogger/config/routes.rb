Rails.application.routes.draw do
  scope "/ulogger" do
    # API:
    post "/client/index.php", to: "api/ulogger#auth", constraints: lambda { |request| request.request_parameters["action"] == "auth" }
    post "/client/index.php", to: "api/ulogger#addtrack", constraints: lambda { |request| request.request_parameters["action"] == "addtrack" }
    post "/client/index.php", to: "api/ulogger#addpos", constraints: lambda { |request| request.request_parameters["action"] == "addpos" }

    # Shared link from ulogger app has url format: "/ulogger/#<id>"
    # redirect.haml will take the hash and redirect to '/ulogger?id='
    get "/", to: "tracks#redirect"
  end
end
