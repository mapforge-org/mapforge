module GarminAccount
  extend ActiveSupport::Concern

  COURSE_PATH = "/training-api/courses/v1/course"

  included do
    field :garmin_token, type: Hash
    # feature id => Garmin courseId, so a repeated send updates the course instead of adding one
    field :garmin_course_ids, type: Hash, default: {}
  end

  # Returns :updated or :created. A course deleted in Garmin Connect answers 404 and gets created again.
  def upload_garmin_course(feature)
    token = garmin_access_token
    course = feature.to_garmin_course
    course_id = garmin_course_ids[feature.id.to_s]
    return :updated if course_id && update_garmin_course(token, course_id, course)
    created = token.post(COURSE_PATH, course_request(course)).parsed
    update!(garmin_course_ids: garmin_course_ids.merge(feature.id.to_s => created["courseId"]))
    :created
  end

  def garmin_access_token
    client = OAuth2::Client.new(ENV["GARMIN_CLIENT_ID"], ENV["GARMIN_CLIENT_SECRET"], GARMIN_CLIENT_OPTIONS)
    token = OAuth2::AccessToken.from_hash(client, garmin_token)
    return token unless token.expired?
    token.refresh.tap { |fresh| save_garmin_token!(fresh) }
  end

  # Takes OmniAuth credentials or an OAuth2::AccessToken. OAuth2::AccessToken#to_hash is no
  # option, its :mode symbol comes back from MongoDB as a string, which the gem does not accept.
  def save_garmin_token!(token)
    update!(garmin_token: { "access_token" => token.token, "refresh_token" => token.refresh_token,
                            "expires_at" => token.expires_at })
  end

  private

  # A new hash per request: OAuth2::AccessToken merges the user's bearer token into these headers
  def course_request(course)
    { body: course.to_json, headers: { "Content-Type" => "application/json" } }
  end

  # false when Garmin no longer has the course
  def update_garmin_course(token, course_id, course)
    token.put("#{COURSE_PATH}/#{course_id}", course_request(course.merge(courseId: course_id)))
    true
  rescue OAuth2::Error => e
    raise unless e.response.status == 404
    false
  end
end
