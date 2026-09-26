def sign_in(user)
  allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
end
